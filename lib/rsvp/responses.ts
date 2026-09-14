import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  activityEvents,
  guests,
  parties,
  MAX_PLUS_ONES,
  type Guest,
} from "@/lib/db/schema";
import { isAttending, type RsvpSubmission } from "@/lib/validation/rsvp";
import type { PartyWithGuests } from "./queries";

export type FieldChange = {
  field: string;
  label: string;
  from: string | null;
  to: string | null;
};

function describeGuest(guest: {
  firstName: string;
  lastName: string;
}): string {
  return `${guest.firstName} ${guest.lastName}`.trim() || "Guest";
}

function makeChange(
  field: string,
  label: string,
  from: unknown,
  to: unknown,
): FieldChange | null {
  const fromValue = from === null || from === undefined || from === "" ? null : String(from);
  const toValue = to === null || to === undefined || to === "" ? null : String(to);

  if (fromValue === toValue) {
    return null;
  }

  return { field, label, from: fromValue, to: toValue };
}

/** Keeps plus ones sorted after the named guests. */
const PLUS_ONE_SORT_BASE = 100;

export type SaveResult = {
  isFirstResponse: boolean;
  changes: FieldChange[];
};

export type SaveContext = {
  ip?: string | null;
  userAgent?: string | null;
  path?: string | null;
  actor?: "guest" | "admin";
};

/**
 * Writes a party's answers and records what changed. Everything happens in one
 * transaction so a partial save can never leave a party half-answered.
 *
 * Guest ids in `submission` are checked against the party before any write, so
 * a crafted POST cannot edit another party's answers.
 */
export async function saveRsvpResponse(
  party: PartyWithGuests,
  submission: RsvpSubmission,
  context: SaveContext = {},
): Promise<SaveResult> {
  const actor = context.actor ?? "guest";
  const namedById = new Map(
    party.guests.filter((g) => g.kind === "named").map((g) => [g.id, g]),
  );
  const existingPlusOnes = party.guests.filter((g) => g.kind === "plus_one");

  const changes: FieldChange[] = [];
  const isFirstResponse = party.respondedAt === null;

  const partyChanges = [
    makeChange("email", "Email", party.email, submission.email),
    makeChange("phone", "Phone", party.phone, submission.phone),
    makeChange("guestMessage", "Message", party.guestMessage, submission.guestMessage),
  ].filter((entry): entry is FieldChange => entry !== null);

  changes.push(...partyChanges);

  await db.transaction(async (tx) => {
    for (const answer of submission.guests) {
      const existing = namedById.get(answer.guestId);

      if (!existing) {
        // Not this party's guest. Ignore rather than fail the whole save.
        continue;
      }

      // Someone who is not coming has nothing to cater for.
      const dietaryNotes = isAttending(answer.rsvpStatus)
        ? answer.dietaryNotes || null
        : null;
      const name = describeGuest(existing);

      for (const entry of [
        makeChange(
          `guest.${existing.id}.rsvpStatus`,
          `${name}: attendance`,
          existing.rsvpStatus,
          answer.rsvpStatus,
        ),
        makeChange(
          `guest.${existing.id}.dietaryNotes`,
          `${name}: dietary notes`,
          existing.dietaryNotes,
          dietaryNotes,
        ),
      ]) {
        if (entry) {
          changes.push(entry);
        }
      }

      await tx
        .update(guests)
        .set({
          rsvpStatus: answer.rsvpStatus,
          dietaryNotes,
          updatedAt: sql`now()`,
        })
        .where(and(eq(guests.id, existing.id), eq(guests.partyId, party.id)));
    }

    await applyPlusOnes(tx, {
      party,
      submission,
      existing: existingPlusOnes,
      changes,
    });

    await tx
      .update(parties)
      .set({
        email: submission.email,
        phone: submission.phone || null,
        guestMessage: submission.guestMessage || null,
        respondedAt: isFirstResponse ? sql`now()` : party.respondedAt,
        lastResponseAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(parties.id, party.id));

    await tx.insert(activityEvents).values({
      partyId: party.id,
      type:
        actor === "admin"
          ? "admin_edit"
          : isFirstResponse
            ? "submit"
            : "update",
      ip: context.ip ?? null,
      userAgent: context.userAgent ?? null,
      path: context.path ?? null,
      metadata: { changes, actor },
    });
  });

  return { isFirstResponse, changes };
}

type PlusOneArgs = {
  party: PartyWithGuests;
  submission: RsvpSubmission;
  existing: Guest[];
  changes: FieldChange[];
};

/**
 * Reconciles the party's extra guests against what they submitted: rows with a
 * matching id are updated, new rows are inserted, and rows they removed are
 * deleted. Anything beyond the party's allowance is ignored, so a crafted POST
 * cannot add more guests than they were given.
 */
async function applyPlusOnes(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  { party, submission, existing, changes }: PlusOneArgs,
) {
  const allowance = Math.max(0, Math.min(party.plusOnesAllowed, MAX_PLUS_ONES));
  const existingById = new Map(existing.map((guest) => [guest.id, guest]));

  const submitted = (submission.plusOnes ?? [])
    // A cleared name is how a guest removes someone they had added.
    .filter((entry) => entry.firstName.trim() || entry.lastName.trim())
    .slice(0, allowance);

  const keptIds = new Set<number>();

  for (const [index, entry] of submitted.entries()) {
    const status = entry.rsvpStatus === "pending" ? "both" : entry.rsvpStatus;
    const firstName = entry.firstName.trim() || "Guest";
    const lastName = entry.lastName.trim();
    const dietaryNotes = isAttending(status)
      ? entry.dietaryNotes.trim() || null
      : null;
    const current = entry.id ? existingById.get(entry.id) : undefined;

    if (current) {
      keptIds.add(current.id);
      const name = describeGuest(current);

      for (const change of [
        makeChange(
          `plusOne.${current.id}.name`,
          "Additional guest name",
          name,
          `${firstName} ${lastName}`.trim(),
        ),
        makeChange(
          `plusOne.${current.id}.rsvpStatus`,
          `${name}: attendance`,
          current.rsvpStatus,
          status,
        ),
        makeChange(
          `plusOne.${current.id}.dietaryNotes`,
          `${name}: dietary notes`,
          current.dietaryNotes,
          dietaryNotes,
        ),
      ]) {
        if (change) {
          changes.push(change);
        }
      }

      await tx
        .update(guests)
        .set({
          firstName,
          lastName,
          sortOrder: PLUS_ONE_SORT_BASE + index,
          rsvpStatus: status,
          dietaryNotes,
          updatedAt: sql`now()`,
        })
        .where(and(eq(guests.id, current.id), eq(guests.partyId, party.id)));

      continue;
    }

    changes.push({
      field: "plusOne.added",
      label: "Additional guest",
      from: null,
      to: `${firstName} ${lastName}`.trim(),
    });

    await tx.insert(guests).values({
      partyId: party.id,
      kind: "plus_one",
      firstName,
      lastName,
      sortOrder: PLUS_ONE_SORT_BASE + index,
      rsvpStatus: status,
      dietaryNotes,
    });
  }

  const removed = existing.filter((guest) => !keptIds.has(guest.id));

  for (const guest of removed) {
    changes.push({
      field: "plusOne.removed",
      label: "Additional guest",
      from: describeGuest(guest),
      to: null,
    });
  }

  if (removed.length > 0) {
    await tx.delete(guests).where(
      and(
        eq(guests.partyId, party.id),
        eq(guests.kind, "plus_one"),
        inArray(
          guests.id,
          removed.map((guest) => guest.id),
        ),
      ),
    );
  }
}
