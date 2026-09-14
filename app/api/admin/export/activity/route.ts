import { desc, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { activityEvents, parties } from "@/lib/db/schema";
import { guardAdminRoute } from "@/lib/rsvp/api-auth";
import { csvResponse, toCsv } from "@/lib/rsvp/csv";

const MAX_ROWS = 20000;

export async function GET() {
  const denied = await guardAdminRoute();

  if (denied) {
    return denied;
  }

  const events = await db
    .select({
      occurredAt: activityEvents.occurredAt,
      type: activityEvents.type,
      partyName: parties.name,
      ip: activityEvents.ip,
      userAgent: activityEvents.userAgent,
      path: activityEvents.path,
      metadata: activityEvents.metadata,
    })
    .from(activityEvents)
    .leftJoin(parties, sql`${parties.id} = ${activityEvents.partyId}`)
    .orderBy(desc(activityEvents.occurredAt))
    .limit(MAX_ROWS);

  const rows = events.map((event) => [
    event.occurredAt.toISOString(),
    event.type,
    event.partyName ?? "",
    event.ip ?? "",
    event.userAgent ?? "",
    event.path ?? "",
    event.metadata ? JSON.stringify(event.metadata) : "",
  ]);

  const csv = toCsv(
    ["occurred_at", "type", "party", "ip", "user_agent", "path", "metadata"],
    rows,
  );

  const stamp = new Date().toISOString().slice(0, 10);

  return csvResponse(csv, `rsvp-activity-${stamp}.csv`);
}
