import Link from "next/link";

import { requireAdmin } from "@/lib/auth/dal";
import { ACTIVITY_LABELS } from "@/lib/rsvp/activity";
import { listActivity } from "@/lib/rsvp/activity-log";
import { formatCode } from "@/lib/rsvp/codes";
import { ACTIVITY_TYPES } from "@/lib/db/schema";

import {
  EmptyState,
  PageHeading,
  formatDateTime,
  inputClass,
  labelClass,
  secondaryButtonClass,
} from "../../components/ui";

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function ActivityPage({
  searchParams,
}: PageProps<"/admin/activity">) {
  await requireAdmin();

  const params = await searchParams;
  const type = one(params.type);
  const ip = one(params.ip);
  const from = one(params.from);
  const to = one(params.to);
  const page = Number(one(params.page)) || 1;

  const { rows, total, pageCount } = await listActivity({
    type: type || undefined,
    ip: ip || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
  });

  const pageLink = (target: number) => {
    const next = new URLSearchParams();
    if (type) next.set("type", type);
    if (ip) next.set("ip", ip);
    if (from) next.set("from", from);
    if (to) next.set("to", to);
    next.set("page", String(target));
    return `/admin/activity?${next.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title="Activity log"
        description={`${total} event${total === 1 ? "" : "s"} recorded.`}
        actions={
          <a href="/api/admin/export/activity" className={secondaryButtonClass}>
            Export CSV
          </a>
        }
      />

      <form className="flex flex-wrap items-end gap-3" method="get">
        <div>
          <label htmlFor="type" className={labelClass}>
            Type
          </label>
          <select
            id="type"
            name="type"
            defaultValue={type}
            className={`${inputClass} mt-1`}
          >
            <option value="">All</option>
            {ACTIVITY_TYPES.map((value) => (
              <option key={value} value={value}>
                {ACTIVITY_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="from" className={labelClass}>
            From
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={from}
            className={`${inputClass} mt-1`}
          />
        </div>

        <div>
          <label htmlFor="to" className={labelClass}>
            To
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={to}
            className={`${inputClass} mt-1`}
          />
        </div>

        <div>
          <label htmlFor="ip" className={labelClass}>
            IP address
          </label>
          <input
            id="ip"
            name="ip"
            defaultValue={ip}
            placeholder="203.0.113.42"
            className={`${inputClass} mt-1`}
          />
        </div>

        <button type="submit" className={secondaryButtonClass}>
          Filter
        </button>

        {type || ip || from || to ? (
          <Link
            href="/admin/activity"
            className="text-xs uppercase tracking-[0.15em] text-muted underline underline-offset-4"
          >
            Clear
          </Link>
        ) : null}
      </form>

      {rows.length === 0 ? (
        <EmptyState>No events match those filters.</EmptyState>
      ) : (
        <>
          <div className="overflow-x-auto border border-accent/25">
            <table className="w-full min-w-[60rem] border-collapse bg-card text-sm">
              <thead>
                <tr className="border-b border-accent/25 text-left">
                  {["When", "Event", "Party", "IP", "Details"].map((label) => (
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
                {rows.map((row) => {
                  const attempted =
                    typeof row.metadata?.attempted === "string"
                      ? formatCode(row.metadata.attempted)
                      : null;
                  const changes = Array.isArray(row.metadata?.changes)
                    ? (row.metadata.changes as { label?: string }[])
                    : [];

                  return (
                    <tr
                      key={row.id}
                      className="border-b border-accent/15 align-top last:border-0"
                    >
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-muted">
                        {formatDateTime(row.occurredAt)}
                      </td>
                      <td className="px-3 py-3 text-foreground">
                        {ACTIVITY_LABELS[row.type] ?? row.type}
                      </td>
                      <td className="px-3 py-3">
                        {row.partyName ? (
                          <Link
                            href={`/admin/parties/${row.partyId}`}
                            className="text-accent-strong underline underline-offset-4"
                          >
                            {row.partyName}
                          </Link>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-muted">
                        {row.ip ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted">
                        {attempted ? <>tried {attempted}</> : null}
                        {changes.length > 0 ? (
                          <span>
                            {changes
                              .map((change) => change.label)
                              .filter(Boolean)
                              .slice(0, 4)
                              .join("; ")}
                            {changes.length > 4
                              ? ` and ${changes.length - 4} more`
                              : ""}
                          </span>
                        ) : null}
                        {!attempted && changes.length === 0 && row.userAgent ? (
                          <span className="line-clamp-1">{row.userAgent}</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pageCount > 1 ? (
            <div className="flex items-center justify-between text-sm">
              {page > 1 ? (
                <Link
                  href={pageLink(page - 1)}
                  className={secondaryButtonClass}
                >
                  Previous
                </Link>
              ) : (
                <span />
              )}

              <span className="text-muted">
                Page {page} of {pageCount}
              </span>

              {page < pageCount ? (
                <Link
                  href={pageLink(page + 1)}
                  className={secondaryButtonClass}
                >
                  Next
                </Link>
              ) : (
                <span />
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
