"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import type { PartySort, PartyStatus } from "@/lib/rsvp/queries";

import { inputClass, secondaryButtonClass } from "../../components/ui";

type Props = {
  search: string;
  status: PartyStatus | "all";
  tag: string;
  sort: PartySort;
  direction: "asc" | "desc";
  tags: string[];
};

/**
 * Filters live in the URL so a filtered view can be bookmarked and shared, and
 * so the server does the filtering.
 */
export function PartyFilters({ search, status, tag, sort, direction, tags }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());

    for (const [key, value] of Object.entries(patch)) {
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    }

    startTransition(() => {
      router.push(`/admin/parties?${next.toString()}`);
    });
  };

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const value = new FormData(event.currentTarget).get("q");
        update({ q: String(value ?? "") });
      }}
    >
      <div className="min-w-[16rem] flex-1">
        <label htmlFor="q" className="block text-xs uppercase tracking-[0.2em] text-muted">
          Search
        </label>
        <input
          id="q"
          name="q"
          defaultValue={search}
          placeholder="Name, guest, code, or email"
          className={`${inputClass} mt-1`}
        />
      </div>

      <div>
        <label htmlFor="status" className="block text-xs uppercase tracking-[0.2em] text-muted">
          Status
        </label>
        <select
          id="status"
          value={status}
          onChange={(event) => update({ status: event.target.value })}
          className={`${inputClass} mt-1`}
        >
          <option value="all">All</option>
          <option value="responded">Responded</option>
          <option value="declined">Declined</option>
          <option value="viewed">Opened, no reply</option>
          <option value="not_viewed">Never opened</option>
        </select>
      </div>

      <div>
        <label htmlFor="tag" className="block text-xs uppercase tracking-[0.2em] text-muted">
          Tag
        </label>
        <select
          id="tag"
          value={tag}
          onChange={(event) => update({ tag: event.target.value })}
          className={`${inputClass} mt-1`}
        >
          <option value="">Any</option>
          {tags.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <button type="submit" className={secondaryButtonClass} disabled={pending}>
        {pending ? "Filtering…" : "Apply"}
      </button>

      {search || status !== "all" || tag || sort !== "name" || direction !== "asc" ? (
        <button
          type="button"
          className="text-xs uppercase tracking-[0.15em] text-muted underline underline-offset-4 hover:text-foreground"
          onClick={() =>
            startTransition(() => {
              router.push("/admin/parties");
            })
          }
        >
          Clear
        </button>
      ) : null}
    </form>
  );
}
