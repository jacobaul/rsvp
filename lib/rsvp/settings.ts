import "server-only";

import { cache } from "react";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { settings, type Settings } from "@/lib/db/schema";

/**
 * Reads the single settings row, creating it on first call. Memoized per
 * request so a page that needs settings in several components hits the
 * database once.
 */
export const getSettings = cache(async (): Promise<Settings> => {
  const existing = await db
    .select()
    .from(settings)
    .where(eq(settings.id, 1))
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  const [created] = await db
    .insert(settings)
    .values({
      id: 1,
      rsvpOpen: false,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
    })
    .onConflictDoNothing()
    .returning();

  if (created) {
    return created;
  }

  // Another request inserted it between our select and insert.
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.id, 1))
    .limit(1);

  return row;
});

/** Base URL for QR codes: the admin setting wins, env is the fallback. */
export function resolveSiteUrl(current: Pick<Settings, "siteUrl">): string {
  const configured = current.siteUrl?.trim();

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
}

export function partyUrl(
  current: Pick<Settings, "siteUrl">,
  formattedCode: string,
): string {
  const base = resolveSiteUrl(current);

  return `${base}/rsvp/${formattedCode}`;
}

/** True when guests may still submit or edit. */
export function rsvpIsEditable(current: Settings, now = new Date()): boolean {
  if (!current.rsvpOpen) {
    return false;
  }

  if (current.rsvpDeadline && now > current.rsvpDeadline) {
    return false;
  }

  return true;
}

export function deadlineHasPassed(current: Settings, now = new Date()): boolean {
  return Boolean(current.rsvpDeadline && now > current.rsvpDeadline);
}
