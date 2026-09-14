"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import type { PartySort, PartyStatus } from "@/lib/rsvp/queries";

import { bulkRegenerateCodesAction } from "../../actions/parties";
import {
  Badge,
  dangerButtonClass,
  formatDateTime,
  secondaryButtonClass,
} from "../../components/ui";

export type PartyRow = {
  id: number;
  name: string;
  code: string;
  guestNames: string[];
  guestCount: number;
  plusOnesAllowed: number;
  status: PartyStatus;
  statusLabel: string;
  viewCount: number;
  lastViewedAt: Date | null;
  lastResponseAt: Date | null;
  tags: string[];
  email: string | null;
};

const columns: { key: PartySort; label: string }[] = [
  { key: "name", label: "Party" },
  { key: "code", label: "Code" },
];

export function PartyTable({
  rows,
  sort,
  direction,
}: {
  rows: PartyRow[];
  sort: PartySort;
  direction: "asc" | "desc";
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const sortLink = (key: PartySort) => {
    const next = new URLSearchParams(params.toString());
    const flip = sort === key && direction === "asc" ? "desc" : "asc";
    next.set("sort", key);
    next.set("dir", flip);
    return `/admin/parties?${next.toString()}`;
  };

  const indicator = (key: PartySort) =>
    sort === key ? (direction === "asc" ? " ▲" : " ▼") : "";

  const toggle = (id: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const allSelected = rows.length > 0 && selected.size === rows.length;

  return (
    <div className="flex flex-col gap-4">
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
          <span className="text-foreground">
            {selected.size} selected
          </span>

          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => {
              const ids = Array.from(selected).join(",");
              router.push(`/admin/qr?ids=${ids}`);
            }}
          >
            QR codes for selected
          </button>

          <form
            action={bulkRegenerateCodesAction}
            onSubmit={(event) => {
              if (
                !confirm(
                  `Regenerate codes for ${selected.size} party(ies)? Any cards already printed with the old codes will stop working.`,
                )
              ) {
                event.preventDefault();
              }
            }}
          >
            {Array.from(selected).map((id) => (
              <input key={id} type="hidden" name="partyIds" value={id} />
            ))}
            <button type="submit" className={dangerButtonClass}>
              Regenerate codes
            </button>
          </form>

          <button
            type="button"
            className="text-xs uppercase tracking-[0.15em] text-muted underline underline-offset-4"
            onClick={() => setSelected(new Set())}
          >
            Clear selection
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto border border-accent/25">
        <table className="w-full min-w-[60rem] border-collapse bg-card text-sm">
          <thead>
            <tr className="border-b border-accent/25 text-left">
              <th scope="col" className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all parties"
                  checked={allSelected}
                  onChange={() =>
                    setSelected(
                      allSelected ? new Set() : new Set(rows.map((r) => r.id)),
                    )
                  }
                  className="h-4 w-4 accent-[var(--accent)]"
                />
              </th>

              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className="px-3 py-3 text-xs uppercase tracking-[0.15em] text-muted"
                >
                  <Link href={sortLink(column.key)} className="hover:text-foreground">
                    {column.label}
                    {indicator(column.key)}
                  </Link>
                </th>
              ))}

              <th scope="col" className="px-3 py-3 text-xs uppercase tracking-[0.15em] text-muted">
                Guests
              </th>
              <th scope="col" className="px-3 py-3 text-xs uppercase tracking-[0.15em] text-muted">
                Status
              </th>
              <th scope="col" className="px-3 py-3 text-xs uppercase tracking-[0.15em] text-muted">
                <Link href={sortLink("last_viewed")} className="hover:text-foreground">
                  Last opened{indicator("last_viewed")}
                </Link>
              </th>
              <th scope="col" className="px-3 py-3 text-xs uppercase tracking-[0.15em] text-muted">
                <Link href={sortLink("last_response")} className="hover:text-foreground">
                  Last reply{indicator("last_response")}
                </Link>
              </th>
              <th scope="col" className="px-3 py-3 text-xs uppercase tracking-[0.15em] text-muted">
                Tags
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-accent/15 last:border-0 hover:bg-background/60"
              >
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.name}`}
                    checked={selected.has(row.id)}
                    onChange={() => toggle(row.id)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                </td>

                <td className="px-3 py-3">
                  <Link
                    href={`/admin/parties/${row.id}`}
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {row.name}
                  </Link>
                  {row.email ? (
                    <div className="text-xs text-muted">{row.email}</div>
                  ) : null}
                </td>

                <td className="px-3 py-3 font-mono text-xs tracking-wider text-muted">
                  {row.code}
                </td>

                <td className="px-3 py-3">
                  <div className="text-foreground">
                    {row.guestNames.join(", ") || "—"}
                  </div>
                  {row.plusOnesAllowed > 0 ? (
                    <div className="text-xs text-muted">
                      +{row.plusOnesAllowed} allowed
                    </div>
                  ) : null}
                </td>

                <td className="px-3 py-3">
                  <Badge tone={row.status}>{row.statusLabel}</Badge>
                </td>

                <td className="px-3 py-3 text-xs text-muted">
                  {formatDateTime(row.lastViewedAt)}
                  {row.viewCount > 0 ? (
                    <div>
                      {row.viewCount} view{row.viewCount === 1 ? "" : "s"}
                    </div>
                  ) : null}
                </td>

                <td className="px-3 py-3 text-xs text-muted">
                  {formatDateTime(row.lastResponseAt)}
                </td>

                <td className="px-3 py-3 text-xs text-muted">
                  {row.tags.join(", ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
