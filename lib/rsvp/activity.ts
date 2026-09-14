import "server-only";

import { and, desc, eq, gt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  activityEvents,
  parties,
  type ActivityType,
} from "@/lib/db/schema";

/**
 * Link-preview fetchers. iMessage, Slack, WhatsApp and friends open the URL as
 * soon as a guest receives it, which would otherwise look like the guest
 * viewed their invite.
 */
const PREVIEW_BOT_PATTERN =
  /(bot|crawler|spider|preview|facebookexternalhit|whatsapp|slackbot|telegrambot|discordbot|twitterbot|linkedinbot|skypeuripreview|applebot|googlebot|bingbot|yandex|duckduckbot|embedly|quora link preview|pinterest|redditbot|vkshare|w3c_validator|curl\/|wget\/|python-requests|okhttp|headlesschrome|lighthouse)/i;

export function isPreviewBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) {
    // A browser always sends one; a missing UA is almost certainly automated.
    return true;
  }

  return PREVIEW_BOT_PATTERN.test(userAgent);
}

const VIEW_DEDUPE_SECONDS = 30;

export type LogEventInput = {
  partyId?: number | null;
  type: ActivityType;
  ip?: string | null;
  userAgent?: string | null;
  path?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function logEvent(input: LogEventInput): Promise<void> {
  try {
    await db.insert(activityEvents).values({
      partyId: input.partyId ?? null,
      type: input.type,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      path: input.path ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (error) {
    // Logging must never break the request it is describing.
    console.error("[activity] failed to record event", input.type, error);
  }
}

/**
 * Records a party-page view and bumps the denormalized counters, unless the
 * same party + IP already produced a view in the last 30 seconds (a refresh,
 * or the browser re-requesting after a redirect).
 */
export async function logPartyView(input: {
  partyId: number;
  ip: string | null;
  userAgent: string | null;
  path: string;
}): Promise<void> {
  if (isPreviewBot(input.userAgent)) {
    return;
  }

  try {
    await db.transaction(async (tx) => {
      const since = new Date(Date.now() - VIEW_DEDUPE_SECONDS * 1000);

      const recent = await tx
        .select({ id: activityEvents.id })
        .from(activityEvents)
        .where(
          and(
            eq(activityEvents.partyId, input.partyId),
            eq(activityEvents.type, "view"),
            gt(activityEvents.occurredAt, since),
            input.ip
              ? eq(activityEvents.ip, input.ip)
              : sql`${activityEvents.ip} is null`,
          ),
        )
        .limit(1);

      if (recent.length > 0) {
        return;
      }

      await tx.insert(activityEvents).values({
        partyId: input.partyId,
        type: "view",
        ip: input.ip,
        userAgent: input.userAgent,
        path: input.path,
      });

      await tx
        .update(parties)
        .set({
          viewCount: sql`${parties.viewCount} + 1`,
          lastViewedAt: sql`now()`,
          firstViewedAt: sql`coalesce(${parties.firstViewedAt}, now())`,
        })
        .where(eq(parties.id, input.partyId));
    });
  } catch (error) {
    console.error("[activity] failed to record view", error);
  }
}

export async function listPartyActivity(partyId: number, limit = 100) {
  return db
    .select()
    .from(activityEvents)
    .where(eq(activityEvents.partyId, partyId))
    .orderBy(desc(activityEvents.occurredAt))
    .limit(limit);
}

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  view: "Viewed invite",
  submit: "Submitted RSVP",
  update: "Updated RSVP",
  lookup_failed: "Failed code lookup",
  admin_edit: "Edited by admin",
  admin_create: "Created by admin",
  admin_delete: "Deleted by admin",
  code_regenerated: "Code regenerated",
  import: "CSV import",
};
