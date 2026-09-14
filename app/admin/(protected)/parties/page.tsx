import Link from "next/link";

import { requireAdmin } from "@/lib/auth/dal";
import { formatCode } from "@/lib/rsvp/codes";
import {
  guestDisplayName,
  listAllTags,
  listParties,
  namedGuests,
  partyStatus,
  PARTY_STATUS_LABELS,
  type PartySort,
  type PartyStatus,
} from "@/lib/rsvp/queries";

import { PartyFilters } from "./PartyFilters";
import { PartyTable } from "./PartyTable";
import {
  Badge,
  EmptyState,
  PageHeading,
  buttonClass,
  secondaryButtonClass,
} from "../../components/ui";

const STATUS_VALUES: (PartyStatus | "all")[] = [
  "all",
  "responded",
  "declined",
  "viewed",
  "not_viewed",
];

const SORT_VALUES: PartySort[] = [
  "name",
  "code",
  "last_viewed",
  "last_response",
  "created",
];

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function PartiesPage({
  searchParams,
}: PageProps<"/admin/parties">) {
  await requireAdmin();

  const params = await searchParams;
  const search = one(params.q);
  const statusParam = one(params.status);
  const status = (
    STATUS_VALUES.includes(statusParam as PartyStatus | "all")
      ? statusParam
      : "all"
  ) as PartyStatus | "all";
  const tag = one(params.tag);
  const sortParam = one(params.sort);
  const sort = (
    SORT_VALUES.includes(sortParam as PartySort) ? sortParam : "name"
  ) as PartySort;
  const direction = one(params.dir) === "desc" ? "desc" : "asc";

  const [parties, tags] = await Promise.all([
    listParties({ search, status, tag, sort, direction }),
    listAllTags(),
  ]);

  const rows = parties.map((party) => ({
    id: party.id,
    name: party.name,
    code: formatCode(party.code),
    guestNames: namedGuests(party).map(guestDisplayName),
    guestCount: party.guests.length,
    plusOnesAllowed: party.plusOnesAllowed,
    status: partyStatus(party),
    statusLabel: PARTY_STATUS_LABELS[partyStatus(party)],
    viewCount: party.viewCount,
    lastViewedAt: party.lastViewedAt,
    lastResponseAt: party.lastResponseAt,
    tags: party.tags,
    email: party.email,
  }));

  const notice = (() => {
    if (params.deleted) return "Party deleted.";
    if (params.regenerated)
      return `Regenerated ${one(params.regenerated)} code(s). Reprint those cards.`;
    return null;
  })();

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title="Parties"
        description={`${parties.length} ${
          parties.length === 1 ? "party" : "parties"
        } shown.`}
        actions={
          <>
            <Link href="/admin/import" className={secondaryButtonClass}>
              Import CSV
            </Link>
            <Link href="/admin/parties/new" className={buttonClass}>
              Add party
            </Link>
          </>
        }
      />

      {notice ? (
        <p className="border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent-strong">
          {notice}
        </p>
      ) : null}

      <PartyFilters
        search={search}
        status={status}
        tag={tag}
        sort={sort}
        direction={direction}
        tags={tags}
      />

      {rows.length === 0 ? (
        <EmptyState>
          {search || status !== "all" || tag ? (
            <>
              No parties match those filters.{" "}
              <Link
                href="/admin/parties"
                className="text-accent-strong underline underline-offset-4"
              >
                Clear filters
              </Link>
            </>
          ) : (
            <>
              No parties yet. Start with{" "}
              <Link
                href="/admin/import"
                className="text-accent-strong underline underline-offset-4"
              >
                a CSV import
              </Link>{" "}
              or{" "}
              <Link
                href="/admin/parties/new"
                className="text-accent-strong underline underline-offset-4"
              >
                add one by hand
              </Link>
              .
            </>
          )}
        </EmptyState>
      ) : (
        <PartyTable rows={rows} sort={sort} direction={direction} />
      )}

      <div className="flex flex-wrap gap-3 text-xs text-muted">
        {STATUS_VALUES.filter((value) => value !== "all").map((value) => (
          <span key={value} className="flex items-center gap-2">
            <Badge tone={value}>{PARTY_STATUS_LABELS[value as PartyStatus]}</Badge>
          </span>
        ))}
      </div>
    </div>
  );
}
