import "server-only";

import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import { guests, parties, type Guest, type Party } from "@/lib/db/schema";
import { normalizeCode } from "./codes";

export type PartyWithGuests = Party & { guests: Guest[] };

export type PartyStatus = "not_viewed" | "viewed" | "responded" | "declined";

/** Derived from the guests' answers; never stored. */
export function partyStatus(party: PartyWithGuests): PartyStatus {
  const answered = party.guests.filter((guest) => guest.rsvpStatus !== "pending");

  if (party.guests.length > 0 && answered.length === party.guests.length) {
    if (party.guests.every((guest) => guest.rsvpStatus === "declined")) {
      return "declined";
    }
  }

  if (answered.length > 0) {
    return "responded";
  }

  return party.viewCount > 0 ? "viewed" : "not_viewed";
}

export const PARTY_STATUS_LABELS: Record<PartyStatus, string> = {
  not_viewed: "Not opened",
  viewed: "Opened, no reply",
  responded: "Responded",
  declined: "Declined",
};

function sortGuests(list: Guest[]): Guest[] {
  return [...list].sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === "named" ? -1 : 1;
    }

    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }

    return a.id - b.id;
  });
}

async function attachGuests(rows: Party[]): Promise<PartyWithGuests[]> {
  if (rows.length === 0) {
    return [];
  }

  const guestRows = await db
    .select()
    .from(guests)
    .where(
      inArray(
        guests.partyId,
        rows.map((row) => row.id),
      ),
    );

  const byParty = new Map<number, Guest[]>();

  for (const guest of guestRows) {
    const list = byParty.get(guest.partyId) ?? [];
    list.push(guest);
    byParty.set(guest.partyId, list);
  }

  return rows.map((row) => ({
    ...row,
    guests: sortGuests(byParty.get(row.id) ?? []),
  }));
}

export async function getPartyByCode(
  code: string,
): Promise<PartyWithGuests | null> {
  const normalized = normalizeCode(code);

  if (!normalized) {
    return null;
  }

  const rows = await db
    .select()
    .from(parties)
    .where(eq(parties.code, normalized))
    .limit(1);

  const [party] = await attachGuests(rows);

  return party ?? null;
}

export async function getPartyById(
  id: number,
): Promise<PartyWithGuests | null> {
  if (!Number.isInteger(id)) {
    return null;
  }

  const rows = await db.select().from(parties).where(eq(parties.id, id)).limit(1);
  const [party] = await attachGuests(rows);

  return party ?? null;
}

export type PartySort =
  | "name"
  | "code"
  | "status"
  | "last_viewed"
  | "last_response"
  | "created";

export type ListPartiesOptions = {
  search?: string;
  status?: PartyStatus | "all";
  tag?: string;
  sort?: PartySort;
  direction?: "asc" | "desc";
};

/**
 * Search covers party name, code, email, and guest names, so the admin can
 * paste anything they have to hand.
 */
export async function listParties(
  options: ListPartiesOptions = {},
): Promise<PartyWithGuests[]> {
  const filters: SQL[] = [];
  const search = options.search?.trim();

  if (search) {
    const pattern = `%${search.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    const normalized = normalizeCode(search);

    const guestMatch = sql`exists (
      select 1 from ${guests}
      where ${guests.partyId} = ${parties.id}
        and (${guests.firstName} || ' ' || ${guests.lastName}) ilike ${pattern}
    )`;

    const clause = or(
      ilike(parties.name, pattern),
      ilike(parties.email, pattern),
      normalized ? ilike(parties.code, `%${normalized}%`) : undefined,
      guestMatch,
    );

    if (clause) {
      filters.push(clause);
    }
  }

  if (options.tag) {
    filters.push(sql`${options.tag} = any(${parties.tags})`);
  }

  const direction = options.direction ?? "asc";
  const order = direction === "desc" ? desc : asc;

  const orderBy = (() => {
    switch (options.sort) {
      case "code":
        return order(parties.code);
      case "last_viewed":
        return order(sql`${parties.lastViewedAt} nulls last`);
      case "last_response":
        return order(sql`${parties.lastResponseAt} nulls last`);
      case "created":
        return order(parties.createdAt);
      default:
        return order(parties.name);
    }
  })();

  const rows = await db
    .select()
    .from(parties)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(orderBy);

  const withGuests = await attachGuests(rows);

  if (!options.status || options.status === "all") {
    return withGuests;
  }

  return withGuests.filter((party) => partyStatus(party) === options.status);
}

export async function listAllTags(): Promise<string[]> {
  const rows = await db
    .select({ tag: sql<string>`distinct unnest(${parties.tags})` })
    .from(parties);

  return rows
    .map((row) => row.tag)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export async function listExistingCodes(): Promise<string[]> {
  const rows = await db.select({ code: parties.code }).from(parties);

  return rows.map((row) => row.code);
}

export function guestDisplayName(guest: Guest): string {
  return `${guest.firstName} ${guest.lastName}`.trim();
}

export function namedGuests(party: PartyWithGuests): Guest[] {
  return party.guests.filter((guest) => guest.kind === "named");
}

export function plusOneGuests(party: PartyWithGuests): Guest[] {
  return party.guests.filter((guest) => guest.kind === "plus_one");
}

/** Remaining plus-one slots this party has not used. */
export function plusOneSlotsLeft(party: PartyWithGuests): number {
  return Math.max(0, party.plusOnesAllowed - plusOneGuests(party).length);
}
