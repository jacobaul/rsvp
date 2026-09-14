import { requireAdmin } from "@/lib/auth/dal";
import { getSettings } from "@/lib/rsvp/settings";

import { PageHeading } from "../../components/ui";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  await requireAdmin();

  const settings = await getSettings();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeading
        title="Settings"
        description="Controls what guests see and how their answers are collected."
      />

      <SettingsForm
        rsvpOpen={settings.rsvpOpen}
        rsvpDeadline={
          settings.rsvpDeadline
            ? settings.rsvpDeadline.toISOString().slice(0, 10)
            : ""
        }
        siteUrl={settings.siteUrl}
        ceremonyLabel={settings.ceremonyLabel}
        receptionLabel={settings.receptionLabel}
        ceremonyEnabled={settings.ceremonyEnabled}
        receptionEnabled={settings.receptionEnabled}
      />
    </div>
  );
}
