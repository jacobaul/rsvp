import Link from "next/link";

import { requireAdmin } from "@/lib/auth/dal";
import { ACTIVITY_LABELS } from "@/lib/rsvp/activity";
import { formatCode } from "@/lib/rsvp/codes";
import { getSettings } from "@/lib/rsvp/settings";
import { getDashboardStats, getRecentActivity } from "@/lib/rsvp/stats";

import { Sparkline } from "../components/Sparkline";
import {
  Card,
  EmptyState,
  PageHeading,
  StatTile,
  formatDateTime,
  secondaryButtonClass,
} from "../components/ui";

function percent(part: number, whole: number): string {
  if (whole === 0) {
    return "0%";
  }

  return `${Math.round((part / whole) * 100)}%`;
}

export default async function AdminDashboard() {
  await requireAdmin();

  const settings = await getSettings();
  const [stats, activity] = await Promise.all([
    getDashboardStats(),
    getRecentActivity(25),
  ]);

  const replied = stats.parties.responded + stats.parties.declined;

  return (
    <div className="flex flex-col gap-8">
      <PageHeading
        title="Dashboard"
        description={
          settings.rsvpOpen
            ? "RSVPs are open. Numbers update as guests respond."
            : "RSVPs are currently closed. Guests with a code see a holding message."
        }
        actions={
          <Link href="/admin/settings" className={secondaryButtonClass}>
            {settings.rsvpOpen ? "Close RSVPs" : "Open RSVPs"}
          </Link>
        }
      />

      <section>
        <h2 className="mb-3 text-sm uppercase tracking-[0.25em] text-muted">
          Parties
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatTile label="Invited" value={stats.parties.total} />
          <StatTile
            label="Responded"
            value={stats.parties.responded}
            hint={percent(stats.parties.responded, stats.parties.total)}
          />
          <StatTile label="Declined" value={stats.parties.declined} />
          <StatTile
            label="Opened, no reply"
            value={stats.parties.viewedNoReply}
          />
          <StatTile label="Never opened" value={stats.parties.neverViewed} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm uppercase tracking-[0.25em] text-muted">
          Guests
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatTile
            label="On the list"
            value={stats.guests.invited}
            hint={`${stats.guests.plusOnesAccepted} additional guests added of ${stats.guests.plusOnesAllowed} allowed`}
          />
          <StatTile
            label={settings.ceremonyLabel}
            value={stats.guests.attendingCeremony}
          />
          <StatTile
            label={settings.receptionLabel}
            value={stats.guests.attendingReception}
          />
          <StatTile label="Declined" value={stats.guests.declined} />
          <StatTile label="No answer yet" value={stats.guests.pending} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <h2 className="mb-4 text-sm uppercase tracking-[0.25em] text-muted">
            Responses over time
          </h2>
          <Sparkline
            points={stats.responsesByDay}
            total={stats.parties.total}
          />
          <p className="mt-3 text-xs text-muted">
            {replied} of {stats.parties.total} parties have replied.
          </p>
        </Card>

        <Card>
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="text-sm uppercase tracking-[0.25em] text-muted">
              Allergies and restrictions
            </h2>
            <span className="font-[family-name:var(--font-display)] text-3xl text-foreground">
              {stats.dietaryCount}
            </span>
          </div>

          {stats.dietary.length === 0 ? (
            <p className="text-sm text-muted">
              No attending guest has reported an allergy or restriction yet.
            </p>
          ) : (
            <ul className="flex max-h-80 flex-col gap-3 overflow-y-auto text-sm">
              {stats.dietary.map((entry) => (
                <li
                  key={`${entry.partyId}-${entry.guestName}`}
                  className="border-b border-accent/15 pb-2 last:border-0"
                >
                  <Link
                    href={`/admin/parties/${entry.partyId}`}
                    className="font-medium text-accent-strong underline underline-offset-4"
                  >
                    {entry.guestName}
                  </Link>
                  <p className="whitespace-pre-wrap text-muted">{entry.notes}</p>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-xs text-muted">
            Everyone attending who told us about an allergy or dietary need.
            Export the responses CSV to hand this to the caterer.
          </p>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm uppercase tracking-[0.25em] text-muted">
            Needs attention
          </h2>

          {stats.needsAttention.repeatViewersNoReply.length === 0 &&
          stats.needsAttention.missingEmail.length === 0 ? (
            <p className="text-sm text-muted">Nothing to chase right now.</p>
          ) : (
            <div className="flex flex-col gap-5 text-sm">
              {stats.needsAttention.repeatViewersNoReply.length > 0 ? (
                <div>
                  <p className="font-medium text-foreground">
                    Opened three or more times without replying
                  </p>
                  <ul className="mt-2 flex flex-col gap-1">
                    {stats.needsAttention.repeatViewersNoReply.map((party) => (
                      <li key={party.id}>
                        <Link
                          href={`/admin/parties/${party.id}`}
                          className="text-accent-strong underline underline-offset-4"
                        >
                          {party.name}
                        </Link>{" "}
                        <span className="text-muted">
                          ({party.viewCount} views)
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {stats.needsAttention.missingEmail.length > 0 ? (
                <div>
                  <p className="font-medium text-foreground">
                    Responded without an email address
                  </p>
                  <ul className="mt-2 flex flex-col gap-1">
                    {stats.needsAttention.missingEmail.map((party) => (
                      <li key={party.id}>
                        <Link
                          href={`/admin/parties/${party.id}`}
                          className="text-accent-strong underline underline-offset-4"
                        >
                          {party.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm uppercase tracking-[0.25em] text-muted">
              Recent activity
            </h2>
            <Link
              href="/admin/activity"
              className="text-xs uppercase tracking-[0.15em] text-accent-strong underline underline-offset-4"
            >
              View all
            </Link>
          </div>

          {activity.length === 0 ? (
            <EmptyState>No activity yet.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {activity.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-accent/15 pb-2 last:border-0"
                >
                  <span className="text-foreground">
                    {ACTIVITY_LABELS[event.type] ?? event.type}
                    {event.partyName ? (
                      <>
                        {" — "}
                        <Link
                          href={`/admin/parties/${event.partyId}`}
                          className="text-accent-strong underline underline-offset-4"
                        >
                          {event.partyName}
                        </Link>
                      </>
                    ) : event.metadata &&
                      typeof event.metadata.attempted === "string" ? (
                      <span className="text-muted">
                        {" — "}
                        {formatCode(event.metadata.attempted)}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted">
                    {formatDateTime(event.occurredAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
