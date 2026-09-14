"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { settingsSchema } from "@/lib/validation/settings";

import type { SettingsState } from "./settings-state";

export async function saveSettings(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireAdmin();

  const parsed = settingsSchema.safeParse({
    rsvpOpen: formData.get("rsvpOpen") === "on",
    rsvpDeadline: String(formData.get("rsvpDeadline") ?? ""),
    siteUrl: String(formData.get("siteUrl") ?? ""),
    ceremonyLabel: String(formData.get("ceremonyLabel") ?? ""),
    receptionLabel: String(formData.get("receptionLabel") ?? ""),
    ceremonyEnabled: formData.get("ceremonyEnabled") === "on",
    receptionEnabled: formData.get("receptionEnabled") === "on",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};

    for (const issue of parsed.error.issues) {
      const key = issue.path.map(String).join(".");

      if (!fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }

    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors,
    };
  }

  const data = parsed.data;

  if (!data.ceremonyEnabled && !data.receptionEnabled) {
    return {
      status: "error",
      message: "At least one event must be enabled, or guests have nothing to answer.",
    };
  }

  await db
    .update(settings)
    .set({
      rsvpOpen: data.rsvpOpen,
      rsvpDeadline: data.rsvpDeadline ? new Date(data.rsvpDeadline) : null,
      siteUrl: data.siteUrl.replace(/\/+$/, ""),
      ceremonyLabel: data.ceremonyLabel,
      receptionLabel: data.receptionLabel,
      ceremonyEnabled: data.ceremonyEnabled,
      receptionEnabled: data.receptionEnabled,
      updatedAt: sql`now()`,
    })
    .where(eq(settings.id, 1));

  revalidatePath("/admin/settings");
  revalidatePath("/admin");

  return { status: "saved", message: "Settings saved." };
}
