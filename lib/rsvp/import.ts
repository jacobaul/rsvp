import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { activityEvents, guests, parties } from "@/lib/db/schema";
import type { ConflictMode } from "@/lib/validation/import";
import { generateUniqueCodes } from "./codes";
import type { ParsedParty } from "./csv-import";

export type ImportSummary = {
  created: number;
  updated: number;
  skipped: number;
  guestsAdded: number;
  guestsRemoved: number;
  codesAssigned: number;
};

export type ImportPlan = {
  toCreate: ParsedParty[];
  conflicts: { parsed: ParsedParty; existingId: number }[];
  codeCollisions: { parsed: ParsedParty; ownerName: string }[];
};

/**
 * Compares the parsed file against what is already in the database so the
 * admin can see exactly what will happen before committing.
 */
export async function planImport(
  parsedParties: ParsedParty[],
): Promise<ImportPlan> {
  const existing = await db
    .select({ id: parties.id, name: parties.name, code: parties.code })
    .from(parties);

  const byName = new Map(
    existing.map((row) => [row.name.trim().toLowerCase(), row]),
  );
  const byCode = new Map(existing.map((row) => [row.code, row]));

  const toCreate: ParsedParty[] = [];
  const conflicts: ImportPlan["conflicts"] = [];
  const codeCollisions: ImportPlan["codeCollisions"] = [];

  for (const parsed of parsedParties) {
    const nameMatch = byName.get(parsed.name.trim().toLowerCase());

    if (parsed.code) {
      const codeOwner = byCode.get(parsed.code);

      if (codeOwner && (!nameMatch || codeOwner.id !== nameMatch.id)) {
        codeCollisions.push({ parsed, ownerName: codeOwner.name });
        continue;
      }
    }

    if (nameMatch) {
      conflicts.push({ parsed, existingId: nameMatch.id });
    } else {
      toCreate.push(parsed);
    }
  }

  return { toCreate, conflicts, codeCollisions };
}

/**
 * Applies the plan in a single transaction: either the whole import lands or
 * none of it does.
 */
export async function commitImport(
  plan: ImportPlan,
  mode: ConflictMode,
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    created: 0,
    updated: 0,
    skipped: plan.codeCollisions.length,
    guestsAdded: 0,
    guestsRemoved: 0,
    codesAssigned: 0,
  };

  const existingCodes = new Set(
    (await db.select({ code: parties.code }).from(parties)).map(
      (row) => row.code,
    ),
  );

  for (const parsed of plan.toCreate) {
    if (parsed.code) {
      existingCodes.add(parsed.code);
    }
  }

  const needCodes = plan.toCreate.filter((parsed) => !parsed.code).length;
  const freshCodes = generateUniqueCodes(needCodes, existingCodes);
  let codeIndex = 0;

  await db.transaction(async (tx) => {
    for (const parsed of plan.toCreate) {
      const code = parsed.code || freshCodes[codeIndex++];

      if (!parsed.code) {
        summary.codesAssigned += 1;
      }

      const [party] = await tx
        .insert(parties)
        .values({
          code,
          name: parsed.name,
          email: parsed.email || null,
          phone: parsed.phone || null,
          plusOnesAllowed: parsed.plusOnesAllowed,
          tags: parsed.tags,
          adminNotes: parsed.adminNotes || null,
        })
        .returning();

      await tx.insert(guests).values(
        parsed.guests.map((guest, index) => ({
          partyId: party.id,
          kind: "named" as const,
          firstName: guest.firstName,
          lastName: guest.lastName,
          sortOrder: index,
        })),
      );

      summary.created += 1;
      summary.guestsAdded += parsed.guests.length;
    }

    if (mode !== "skip") {
      for (const conflict of plan.conflicts) {
        const { parsed, existingId } = conflict;

        await tx
          .update(parties)
          .set({
            name: parsed.name,
            email: parsed.email || undefined,
            phone: parsed.phone || undefined,
            plusOnesAllowed: parsed.plusOnesAllowed,
            tags: parsed.tags,
            adminNotes: parsed.adminNotes || undefined,
            updatedAt: sql`now()`,
          })
          .where(eq(parties.id, existingId));

        const current = await tx
          .select()
          .from(guests)
          .where(
            and(eq(guests.partyId, existingId), eq(guests.kind, "named")),
          );

        if (mode === "replace") {
          // Wipe named guests and rebuild from the file.
          const ids = current.map((guest) => guest.id);

          if (ids.length > 0) {
            await tx.delete(guests).where(inArray(guests.id, ids));
            summary.guestsRemoved += ids.length;
          }

          await tx.insert(guests).values(
            parsed.guests.map((guest, index) => ({
              partyId: existingId,
              kind: "named" as const,
              firstName: guest.firstName,
              lastName: guest.lastName,
              sortOrder: index,
            })),
          );

          summary.guestsAdded += parsed.guests.length;
        } else {
          // `update`: add guests the file introduces, keep existing answers.
          const seen = new Set(
            current.map((guest) =>
              `${guest.firstName} ${guest.lastName}`.trim().toLowerCase(),
            ),
          );

          const additions = parsed.guests.filter(
            (guest) =>
              !seen.has(
                `${guest.firstName} ${guest.lastName}`.trim().toLowerCase(),
              ),
          );

          if (additions.length > 0) {
            await tx.insert(guests).values(
              additions.map((guest, index) => ({
                partyId: existingId,
                kind: "named" as const,
                firstName: guest.firstName,
                lastName: guest.lastName,
                sortOrder: current.length + index,
              })),
            );

            summary.guestsAdded += additions.length;
          }
        }

        summary.updated += 1;
      }
    } else {
      summary.skipped += plan.conflicts.length;
    }

    await tx.insert(activityEvents).values({
      partyId: null,
      type: "import",
      metadata: { ...summary, mode },
    });
  });

  return summary;
}
