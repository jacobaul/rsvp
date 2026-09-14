import Link from "next/link";

import { requireAdmin } from "@/lib/auth/dal";
import { formatCode } from "@/lib/rsvp/codes";
import { guestDisplayName, listParties } from "@/lib/rsvp/queries";
import {
  RSVP_STATUS_LABELS,
  type RsvpStatusInput,
} from "@/lib/validation/rsvp";

import {
  Badge,
  EmptyState,
  PageHeading,
  formatDateTime,
  secondaryButtonClass,
} from "../../components/ui";

const FILTERS = [
  { value: "all", label: "All guests" },
  { value: "attending", label: "Attending" },
  { value: "dietary", label: "Has restrictions" },
  { value: "ceremony", label: "Ceremony" },
  { value: "reception", label: "Reception" },
  { value: "declined", label: "Declined" },
  { value: "pending", label: "No answer" },
] as const;

type FilterValue = (typeof FILTERS)[number]["value"];

function matches(
  status: RsvpStatusInput,
  filter: FilterValue,
  dietaryNotes: string | null,
): boolean {
  switch (filter) {
    case "dietary":
      return Boolean(dietaryNotes?.trim());
    case "attending":
      return status === "both" || status === "ceremony" || status === "reception";
    case "ceremony":
      return status === "both" || status === "ceremony";
    case "reception":
      return status === "both" || status === "reception";
    case "declined":
      return status === "declined";
    case "pending":
      return status === "pending";
    default:
      return true;
  }
}

function tone(status: RsvpStatusInput): string {
  if (status === "declined") return "declined";
  if (status === "pending") return "not_viewed";
  return "responded";
}

export default async function ResponsesPage({
  searchParams,
}: PageProps<"/admin/responses">) {
  await requireAdmin();

  const [params, parties] = await Promise.all([
    searchParams,
    listParties({ sort: "name" }),
  ]);

  const filterParam = Array.isArray(params.filter)
    ? params.filter[0]
    : params.filter;
  const filter = (
    FILTERS.some((entry) => entry.value === filterParam) ? filterParam : "all"
  ) as FilterValue;

  const rows = parties.flatMap((party) =>
    party.guests
      .filter((guest) => matches(guest.rsvpStatus, filter, guest.dietaryNotes))
      .map((guest) => ({
        key: `${party.id}-${guest.id}`,
        partyId: party.id,
        partyName: party.name,
        code: formatCode(party.code),
        guestName: guestDisplayName(guest),
        isPlusOne: guest.kind === "plus_one",
        status: guest.rsvpStatus,
        dietaryNotes: guest.dietaryNotes?.trim() ?? "",
        email: party.email ?? "",
        lastResponseAt: party.lastResponseAt,
      })),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title="Responses"
        description={`${rows.length} guest row${rows.length === 1 ? "" : "s"}.`}
        actions={
          <a href="/api/admin/export/responses" className={secondaryButtonClass}>
            Export CSV
          </a>
        }
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((entry) => (
          <Link
            key={entry.value}
            href={
              entry.value === "all"
                ? "/admin/responses"
                : `/admin/responses?filter=${entry.value}`
            }
            className={
              filter === entry.value
                ? "border border-accent bg-accent px-3 py-1 text-xs uppercase tracking-[0.15em] text-white"
                : "border border-accent/30 px-3 py-1 text-xs uppercase tracking-[0.15em] text-muted transition hover:border-accent hover:text-foreground"
            }
          >
            {entry.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState>No guests match that filter.</EmptyState>
      ) : (
        <div className="overflow-x-auto border border-accent/25">
          <table className="w-full min-w-[56rem] border-collapse bg-card text-sm">
            <thead>
              <tr className="border-b border-accent/25 text-left">
                {[
                  "Guest",
                  "Party",
                  "Response",
                  "Allergies / restrictions",
                  "Email",
                  "Updated",
                ].map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className="px-3 py-3 text-xs uppercase tracking-[0.15em] text-muted"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.key}
                  className="border-b border-accent/15 last:border-0"
                >
                  <td className="px-3 py-3 text-foreground">
                    {row.guestName}
                    {row.isPlusOne ? (
                      <span className="ml-2 text-xs text-muted">(extra guest)</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/admin/parties/${row.partyId}`}
                      className="text-accent-strong underline underline-offset-4"
                    >
                      {row.partyName}
                    </Link>
                    <div className="font-mono text-xs text-muted">
                      {row.code}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={tone(row.status)}>
                      {RSVP_STATUS_LABELS[row.status]}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">
                    {row.dietaryNotes ? (
                      <span className="whitespace-pre-wrap text-amber-900">
                        {row.dietaryNotes}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-muted">{row.email || "—"}</td>
                  <td className="px-3 py-3 text-xs text-muted">
                    {formatDateTime(row.lastResponseAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
