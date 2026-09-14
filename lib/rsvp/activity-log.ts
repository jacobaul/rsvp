import "server-only";

import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import { activityEvents, parties, type ActivityType } from "@/lib/db/schema";

export type ActivityFilters = {
  type?: string;
  partyId?: number;
  from?: string;
  to?: string;
  ip?: string;
  page?: number;
};

export const ACTIVITY_PAGE_SIZE = 100;

export type ActivityRow = {
  id: number;
  type: ActivityType;
  occurredAt: Date;
  partyId: number | null;
  partyName: string | null;
  ip: string | null;
  userAgent: string | null;
  path: string | null;
  metadata: Record<string, unknown> | null;
};

export async function listActivity(filters: ActivityFilters): Promise<{
  rows: ActivityRow[];
  total: number;
  page: number;
  pageCount: number;
}> {
  const clauses: SQL[] = [];

  if (filters.type) {
    clauses.push(eq(activityEvents.type, filters.type as ActivityType));
  }

  if (filters.partyId) {
    clauses.push(eq(activityEvents.partyId, filters.partyId));
  }

  if (filters.ip) {
    clauses.push(sql`host(${activityEvents.ip}) = ${filters.ip}`);
  }

  if (filters.from && !Number.isNaN(Date.parse(filters.from))) {
    clauses.push(gte(activityEvents.occurredAt, new Date(filters.from)));
  }

  if (filters.to && !Number.isNaN(Date.parse(filters.to))) {
    // Inclusive of the whole end day.
    const to = new Date(filters.to);
    to.setHours(23, 59, 59, 999);
    clauses.push(lte(activityEvents.occurredAt, to));
  }

  const where = clauses.length > 0 ? and(...clauses) : undefined;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activityEvents)
    .where(where);

  const total = Number(countRow?.count ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);

  const rows = await db
    .select({
      id: activityEvents.id,
      type: activityEvents.type,
      occurredAt: activityEvents.occurredAt,
      partyId: activityEvents.partyId,
      partyName: parties.name,
      ip: activityEvents.ip,
      userAgent: activityEvents.userAgent,
      path: activityEvents.path,
      metadata: activityEvents.metadata,
    })
    .from(activityEvents)
    .leftJoin(parties, eq(parties.id, activityEvents.partyId))
    .where(where)
    .orderBy(desc(activityEvents.occurredAt))
    .limit(ACTIVITY_PAGE_SIZE)
    .offset((page - 1) * ACTIVITY_PAGE_SIZE);

  return { rows, total, page, pageCount };
}
