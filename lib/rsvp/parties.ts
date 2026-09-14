import "server-only";

import { and, eq, inArray, notInArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { activityEvents, guests, parties } from "@/lib/db/schema";
import type { PartyFormInput } from "@/lib/validation/party";
import { generateUniqueCodes } from "./codes";
import { listExistingCodes, type PartyWithGuests } from "./queries";

export class DuplicateCodeError extends Error {
  constructor() {
    super("That code is already in use.");
    this.name = "DuplicateCodeError";
  }
}

async function nextCode(): Promise<string> {
  const existing = await listExistingCodes();

  return generateUniqueCodes(1, existing)[0];
}

export async function createParty(
  input: PartyFormInput,
  options: { code?: string } = {},
): Promise<PartyWithGuests> {
  const code = options.code ?? (await nextCode());

  return db.transaction(async (tx) => {
    const [party] = await tx
      .insert(parties)
      .values({
        code,
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        plusOnesAllowed: input.plusOnesAllowed,
        tags: input.tags,
        adminNotes: input.adminNotes || null,
        guestMessage: input.guestMessage || null,
      })
      .returning();

    const inserted = await tx
      .insert(guests)
      .values(
        input.guests.map((guest, index) => ({
          partyId: party.id,
          kind: "named" as const,
          firstName: guest.firstName,
          lastName: guest.lastName,
          sortOrder: index,
          rsvpStatus: guest.rsvpStatus,
          dietaryNotes: guest.dietaryNotes || null,
        })),
      )
      .returning();

    await tx.insert(activityEvents).values({
      partyId: party.id,
      type: "admin_create",
      metadata: { name: party.name, guestCount: inserted.length },
    });

    return { ...party, guests: inserted };
  });
}

/**
 * Replaces the party's fields and reconciles its named guests: rows with an id
 * are updated, rows without are inserted, and named rows no longer present are
 * deleted. The plus-one row is left alone; guests own that.
 */
export async function updateParty(
  existing: PartyWithGuests,
  input: PartyFormInput,
): Promise<void> {
  await db.transaction(async (tx) => {
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    const track = (field: string, from: unknown, to: unknown) => {
      const a = from ?? null;
      const b = to === "" ? null : (to ?? null);

      if (JSON.stringify(a) !== JSON.stringify(b)) {
        changes[field] = { from: a, to: b };
      }
    };

    track("name", existing.name, input.name);
    track("email", existing.email, input.email);
    track("phone", existing.phone, input.phone);
    track("plusOnesAllowed", existing.plusOnesAllowed, input.plusOnesAllowed);
    track("tags", existing.tags, input.tags);
    track("adminNotes", existing.adminNotes, input.adminNotes);
    track("guestMessage", existing.guestMessage, input.guestMessage);

    await tx
      .update(parties)
      .set({
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        plusOnesAllowed: input.plusOnesAllowed,
        tags: input.tags,
        adminNotes: input.adminNotes || null,
        guestMessage: input.guestMessage || null,
        updatedAt: sql`now()`,
      })
      .where(eq(parties.id, existing.id));

    const keptIds: number[] = [];

    for (const [index, guest] of input.guests.entries()) {
      const values = {
        firstName: guest.firstName,
        lastName: guest.lastName,
        sortOrder: index,
        rsvpStatus: guest.rsvpStatus,
        dietaryNotes: guest.dietaryNotes || null,
        updatedAt: sql`now()`,
      };

      const current = guest.id
        ? existing.guests.find(
            (row) => row.id === guest.id && row.kind === "named",
          )
        : undefined;

      if (current) {
        keptIds.push(current.id);
        await tx
          .update(guests)
          .set(values)
          .where(
            and(eq(guests.id, current.id), eq(guests.partyId, existing.id)),
          );
      } else {
        const [created] = await tx
          .insert(guests)
          .values({ ...values, partyId: existing.id, kind: "named" })
          .returning({ id: guests.id });

        keptIds.push(created.id);
      }
    }

    // Remove named guests the admin deleted from the form.
    await tx
      .delete(guests)
      .where(
        and(
          eq(guests.partyId, existing.id),
          eq(guests.kind, "named"),
          keptIds.length > 0 ? notInArray(guests.id, keptIds) : undefined,
        ),
      );

    // Lowering the allowance drops the extra guests that no longer fit,
    // newest first, so earlier answers survive.
    if (input.plusOnesAllowed < existing.plusOnesAllowed) {
      const current = existing.guests
        .filter((guest) => guest.kind === "plus_one")
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

      const surplus = current.slice(input.plusOnesAllowed);

      if (surplus.length > 0) {
        await tx.delete(guests).where(
          inArray(
            guests.id,
            surplus.map((guest) => guest.id),
          ),
        );
      }
    }

    await tx.insert(activityEvents).values({
      partyId: existing.id,
      type: "admin_edit",
      metadata: { changes, actor: "admin" },
    });
  });
}

export async function deleteParty(id: number, name: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(parties).where(eq(parties.id, id));

    // The party row is gone, so this event is not tied to one.
    await tx.insert(activityEvents).values({
      partyId: null,
      type: "admin_delete",
      metadata: { deletedPartyId: id, name },
    });
  });
}

export async function regenerateCode(id: number): Promise<string> {
  const existing = await listExistingCodes();
  const code = generateUniqueCodes(1, existing)[0];

  await db.transaction(async (tx) => {
    const [previous] = await tx
      .select({ code: parties.code })
      .from(parties)
      .where(eq(parties.id, id))
      .limit(1);

    await tx
      .update(parties)
      .set({ code, updatedAt: sql`now()` })
      .where(eq(parties.id, id));

    await tx.insert(activityEvents).values({
      partyId: id,
      type: "code_regenerated",
      metadata: { from: previous?.code ?? null, to: code },
    });
  });

  return code;
}

export async function regenerateCodesForParties(
  ids: number[],
): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }

  const existing = new Set(await listExistingCodes());
  const fresh = generateUniqueCodes(ids.length, existing);

  await db.transaction(async (tx) => {
    const previous = await tx
      .select({ id: parties.id, code: parties.code })
      .from(parties)
      .where(inArray(parties.id, ids));

    const byId = new Map(previous.map((row) => [row.id, row.code]));

    for (const [index, id] of ids.entries()) {
      await tx
        .update(parties)
        .set({ code: fresh[index], updatedAt: sql`now()` })
        .where(eq(parties.id, id));

      await tx.insert(activityEvents).values({
        partyId: id,
        type: "code_regenerated",
        metadata: { from: byId.get(id) ?? null, to: fresh[index], bulk: true },
      });
    }
  });

  return ids.length;
}
