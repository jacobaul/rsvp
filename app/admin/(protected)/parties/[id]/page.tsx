import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/dal";
import { ACTIVITY_LABELS, listPartyActivity } from "@/lib/rsvp/activity";
import { formatCode } from "@/lib/rsvp/codes";
import {
  getPartyById,
  guestDisplayName,
  namedGuests,
  partyStatus,
  plusOneGuests,
  PARTY_STATUS_LABELS,
} from "@/lib/rsvp/queries";
import { getSettings, partyUrl, resolveSiteUrl } from "@/lib/rsvp/settings";
import { RSVP_STATUS_LABELS } from "@/lib/validation/rsvp";

import { QrPreview } from "../../../components/QrPreview";
import {
  Badge,
  Card,
  EmptyState,
  PageHeading,
  dangerButtonClass,
  formatDateTime,
  secondaryButtonClass,
} from "../../../components/ui";
import { deletePartyAction, regenerateCodeAction } from "../../../actions/parties";
import { AdminResponseForm } from "./AdminResponseForm";
import { CopyButton } from "./CopyButton";
import { PartyForm } from "../PartyForm";

type FieldChange = { label?: string; field?: string; from?: unknown; to?: unknown };

function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "empty";
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "empty";
  }

  return String(value);
}

export default async function PartyDetailPage({
  params,
  searchParams,
}: PageProps<"/admin/parties/[id]">) {
  await requireAdmin();

  const { id } = await params;
  const partyId = Number(id);

  if (!Number.isInteger(partyId)) {
    notFound();
  }

  const party = await getPartyById(partyId);

  if (!party) {
    notFound();
  }

  const [settings, activity, query] = await Promise.all([
    getSettings(),
    listPartyActivity(party.id, 100),
    searchParams,
  ]);

  const formatted = formatCode(party.code);
  const url = partyUrl(settings, formatted);
  const hasSiteUrl = resolveSiteUrl(settings) !== "";
  const named = namedGuests(party);
  const plusOnes = plusOneGuests(party);
  const status = partyStatus(party);

  const notice = (() => {
    if (query.saved) return "Saved.";
    if (query.code) return "New code generated. The previous code no longer works.";
    return null;
  })();

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title={party.name}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <Badge tone={status}>{PARTY_STATUS_LABELS[status]}</Badge>
            <span>
              {party.viewCount} view{party.viewCount === 1 ? "" : "s"}
            </span>
            <span>Created {formatDateTime(party.createdAt)}</span>
          </span>
        }
        actions={
          <>
            <Link href="/admin/parties" className={secondaryButtonClass}>
              Back to list
            </Link>
            <form
              action={deletePartyAction}
              // Deleting cascades to guests and this party's activity history.
            >
              <input type="hidden" name="partyId" value={party.id} />
              <button type="submit" className={dangerButtonClass}>
                Delete party
              </button>
            </form>
          </>
        }
      />

      {notice ? (
        <p className="border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent-strong">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-6">
          <PartyForm
            values={{
              id: party.id,
              name: party.name,
              email: party.email ?? "",
              phone: party.phone ?? "",
              plusOnesAllowed: party.plusOnesAllowed,
              tags: party.tags,
              adminNotes: party.adminNotes ?? "",
              guestMessage: party.guestMessage ?? "",
              guests: named.map((guest) => ({
                id: guest.id,
                firstName: guest.firstName,
                lastName: guest.lastName,
              })),
            }}
          />

          <Card>
            <h2 className="mb-4 text-sm uppercase tracking-[0.25em] text-muted">
              Response
            </h2>

            {party.respondedAt ? (
              <p className="mb-4 text-xs text-muted">
                First replied {formatDateTime(party.respondedAt)}
                {party.lastResponseAt &&
                party.lastResponseAt.getTime() !== party.respondedAt.getTime()
                  ? ` · last updated ${formatDateTime(party.lastResponseAt)}`
                  : ""}
              </p>
            ) : (
              <p className="mb-4 text-xs text-muted">
                No response yet. You can fill this in on their behalf, for
                example after a phone call.
              </p>
            )}

            <AdminResponseForm
              partyId={party.id}
              email={party.email ?? ""}
              phone={party.phone ?? ""}
              guestMessage={party.guestMessage ?? ""}
              plusOnesAllowed={party.plusOnesAllowed}
              guests={named.map((guest) => ({
                id: guest.id,
                name: guestDisplayName(guest),
                rsvpStatus: guest.rsvpStatus,
                dietaryNotes: guest.dietaryNotes ?? "",
              }))}
              plusOnes={plusOnes.map((guest) => ({
                id: guest.id,
                name: guestDisplayName(guest),
                rsvpStatus: guest.rsvpStatus,
                dietaryNotes: guest.dietaryNotes ?? "",
              }))}
              ceremonyLabel={settings.ceremonyLabel}
              receptionLabel={settings.receptionLabel}
            />

            {party.guestMessage ? (
              <div className="mt-5 border-t border-accent/20 pt-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">
                  Message from the party
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                  {party.guestMessage}
                </p>
              </div>
            ) : null}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-4 text-sm uppercase tracking-[0.25em] text-muted">
              Invitation code
            </h2>

            <p className="font-mono text-2xl tracking-[0.2em] text-foreground">
              {formatted}
            </p>

            {hasSiteUrl ? (
              <>
                <p className="mt-3 break-all text-xs text-muted">{url}</p>
                <div className="mt-4">
                  <QrPreview url={url} size={180} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <CopyButton value={url} label="Copy link" />
                  <CopyButton value={formatted} label="Copy code" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={`/api/admin/qr/${party.id}?format=svg`}
                    className={secondaryButtonClass}
                  >
                    SVG
                  </a>
                  <a
                    href={`/api/admin/qr/${party.id}?format=png`}
                    className={secondaryButtonClass}
                  >
                    PNG
                  </a>
                </div>
              </>
            ) : (
              <p className="mt-3 border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Set the site URL in{" "}
                <Link
                  href="/admin/settings"
                  className="underline underline-offset-4"
                >
                  Settings
                </Link>{" "}
                before generating QR codes, or they will point nowhere.
              </p>
            )}

            <form
              action={regenerateCodeAction}
              className="mt-5 border-t border-accent/20 pt-4"
            >
              <input type="hidden" name="partyId" value={party.id} />
              <button type="submit" className={dangerButtonClass}>
                Regenerate code
              </button>
              <p className="mt-2 text-xs text-muted">
                Use only if a card has not been sent, or a code has leaked. Any
                printed card with the old code stops working.
              </p>
            </form>
          </Card>

          <Card>
            <h2 className="mb-4 text-sm uppercase tracking-[0.25em] text-muted">
              Current answers
            </h2>

            {party.guests.length === 0 ? (
              <p className="text-sm text-muted">No guests on this party.</p>
            ) : (
              <ul className="flex flex-col gap-3 text-sm">
                {party.guests.map((guest) => (
                  <li
                    key={guest.id}
                    className="border-b border-accent/15 pb-3 last:border-0 last:pb-0"
                  >
                    <p className="font-medium text-foreground">
                      {guestDisplayName(guest)}
                      {guest.kind === "plus_one" ? (
                        <span className="ml-2 text-xs text-muted">
                          (additional guest)
                        </span>
                      ) : null}
                    </p>
                    <p className="text-muted">
                      {RSVP_STATUS_LABELS[guest.rsvpStatus]}
                    </p>
                    {guest.dietaryNotes ? (
                      <p className="mt-1 whitespace-pre-wrap text-xs text-amber-900">
                        Allergies / restrictions: {guest.dietaryNotes}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 text-sm uppercase tracking-[0.25em] text-muted">
              Activity
            </h2>

            {activity.length === 0 ? (
              <EmptyState>Nothing recorded yet.</EmptyState>
            ) : (
              <ul className="flex max-h-[32rem] flex-col gap-3 overflow-y-auto text-sm">
                {activity.map((event) => {
                  const changes = Array.isArray(event.metadata?.changes)
                    ? (event.metadata.changes as FieldChange[])
                    : [];

                  return (
                    <li
                      key={event.id}
                      className="border-b border-accent/15 pb-3 last:border-0"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium text-foreground">
                          {ACTIVITY_LABELS[event.type] ?? event.type}
                        </span>
                        <span className="text-xs text-muted">
                          {formatDateTime(event.occurredAt)}
                        </span>
                      </div>

                      {event.ip ? (
                        <p className="text-xs text-muted">{event.ip}</p>
                      ) : null}

                      {changes.length > 0 ? (
                        <ul className="mt-2 flex flex-col gap-1 text-xs text-muted">
                          {changes.map((change, index) => (
                            <li key={`${event.id}-${index}`}>
                              {change.label ?? change.field}:{" "}
                              <span className="line-through">
                                {renderValue(change.from)}
                              </span>{" "}
                              → {renderValue(change.to)}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
