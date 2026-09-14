import "server-only";

import { desc, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { activityEvents, guests, parties } from "@/lib/db/schema";
import { listParties, partyStatus, type PartyWithGuests } from "./queries";

export type PartyTotals = {
  total: number;
  responded: number;
  declined: number;
  viewedNoReply: number;
  neverViewed: number;
};

export type GuestTotals = {
  invited: number;
  attendingCeremony: number;
  attendingReception: number;
  attendingAny: number;
  declined: number;
  pending: number;
  plusOnesAllowed: number;
  plusOnesAccepted: number;
};

/** One attending guest who reported an allergy or restriction. */
export type DietaryEntry = {
  partyId: number;
  partyName: string;
  guestName: string;
  notes: string;
};

export type ResponsePoint = {
  date: string;
  count: number;
};

export type NeedsAttention = {
  repeatViewersNoReply: PartyWithGuests[];
  missingEmail: PartyWithGuests[];
};

export type DashboardStats = {
  parties: PartyTotals;
  guests: GuestTotals;
  dietary: DietaryEntry[];
  dietaryCount: number;
  responsesByDay: ResponsePoint[];
  needsAttention: NeedsAttention;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const all = await listParties();

  const partyTotals: PartyTotals = {
    total: all.length,
    responded: 0,
    declined: 0,
    viewedNoReply: 0,
    neverViewed: 0,
  };

  const guestTotals: GuestTotals = {
    invited: 0,
    attendingCeremony: 0,
    attendingReception: 0,
    attendingAny: 0,
    declined: 0,
    pending: 0,
    plusOnesAllowed: 0,
    plusOnesAccepted: 0,
  };

  const dietary: DietaryEntry[] = [];
  const repeatViewersNoReply: PartyWithGuests[] = [];
  const missingEmail: PartyWithGuests[] = [];

  for (const party of all) {
    switch (partyStatus(party)) {
      case "responded":
        partyTotals.responded += 1;
        break;
      case "declined":
        partyTotals.declined += 1;
        break;
      case "viewed":
        partyTotals.viewedNoReply += 1;
        break;
      default:
        partyTotals.neverViewed += 1;
    }

    guestTotals.plusOnesAllowed += party.plusOnesAllowed;

    if (party.respondedAt && !party.email) {
      missingEmail.push(party);
    }

    if (party.viewCount >= 3 && !party.respondedAt) {
      repeatViewersNoReply.push(party);
    }

    for (const guest of party.guests) {
      guestTotals.invited += 1;

      if (guest.kind === "plus_one") {
        guestTotals.plusOnesAccepted += 1;
      }

      switch (guest.rsvpStatus) {
        case "both":
          guestTotals.attendingCeremony += 1;
          guestTotals.attendingReception += 1;
          guestTotals.attendingAny += 1;
          break;
        case "ceremony":
          guestTotals.attendingCeremony += 1;
          guestTotals.attendingAny += 1;
          break;
        case "reception":
          guestTotals.attendingReception += 1;
          guestTotals.attendingAny += 1;
          break;
        case "declined":
          guestTotals.declined += 1;
          break;
        default:
          guestTotals.pending += 1;
      }

      const attending =
        guest.rsvpStatus !== "pending" && guest.rsvpStatus !== "declined";

      if (attending && guest.dietaryNotes?.trim()) {
        dietary.push({
          partyId: party.id,
          partyName: party.name,
          guestName: `${guest.firstName} ${guest.lastName}`.trim(),
          notes: guest.dietaryNotes.trim(),
        });
      }
    }
  }

  dietary.sort(
    (a, b) =>
      a.partyName.localeCompare(b.partyName) ||
      a.guestName.localeCompare(b.guestName),
  );

  return {
    parties: partyTotals,
    guests: guestTotals,
    dietary,
    dietaryCount: dietary.length,
    responsesByDay: await getResponsesByDay(),
    needsAttention: {
      repeatViewersNoReply: repeatViewersNoReply.slice(0, 10),
      missingEmail: missingEmail.slice(0, 10),
    },
  };
}

/** Daily counts of first-time submissions, oldest first. */
export async function getResponsesByDay(): Promise<ResponsePoint[]> {
  const rows = await db
    .select({
      date: sql<string>`to_char(${parties.respondedAt} at time zone 'America/Vancouver', 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(parties)
    .where(sql`${parties.respondedAt} is not null`)
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  return rows.map((row) => ({ date: row.date, count: Number(row.count) }));
}

export async function getRecentActivity(limit = 25) {
  return db
    .select({
      id: activityEvents.id,
      type: activityEvents.type,
      occurredAt: activityEvents.occurredAt,
      partyId: activityEvents.partyId,
      partyName: parties.name,
      ip: activityEvents.ip,
      metadata: activityEvents.metadata,
    })
    .from(activityEvents)
    .leftJoin(parties, sql`${parties.id} = ${activityEvents.partyId}`)
    .orderBy(desc(activityEvents.occurredAt))
    .limit(limit);
}

export async function countGuests(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(guests);

  return Number(row?.count ?? 0);
}
