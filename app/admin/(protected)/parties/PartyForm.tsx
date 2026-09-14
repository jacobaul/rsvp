"use client";

import Link from "next/link";

import { MAX_PLUS_ONES } from "@/lib/db/schema";
import { useActionState, useState } from "react";

import { createPartyAction, updatePartyAction } from "../../actions/parties";
import {
  initialPartyFormState,
  type PartyFormState,
} from "../../actions/form-state";
import {
  Card,
  buttonClass,
  inputClass,
  labelClass,
  secondaryButtonClass,
} from "../../components/ui";

export type PartyFormGuest = {
  id?: number;
  firstName: string;
  lastName: string;
};

export type PartyFormValues = {
  id?: number;
  name: string;
  email: string;
  phone: string;
  plusOnesAllowed: number;
  tags: string[];
  adminNotes: string;
  guestMessage: string;
  guests: PartyFormGuest[];
};

const emptyGuest: PartyFormGuest = { firstName: "", lastName: "" };

export function PartyForm({ values }: { values: PartyFormValues }) {
  const isEdit = values.id !== undefined;
  const [state, action, pending] = useActionState<PartyFormState, FormData>(
    isEdit ? updatePartyAction : createPartyAction,
    initialPartyFormState,
  );

  const [guestRows, setGuestRows] = useState<PartyFormGuest[]>(
    values.guests.length > 0 ? values.guests : [emptyGuest],
  );

  const updateRow = (index: number, patch: Partial<PartyFormGuest>) => {
    setGuestRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  const removeRow = (index: number) => {
    setGuestRows((rows) =>
      rows.length === 1 ? [emptyGuest] : rows.filter((_, i) => i !== index),
    );
  };

  return (
    <form action={action} className="flex flex-col gap-6">
      {isEdit ? (
        <input type="hidden" name="partyId" value={values.id} />
      ) : null}

      <Card>
        <h2 className="mb-4 text-sm uppercase tracking-[0.25em] text-muted">
          Party
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="name" className={labelClass}>
              Party name
            </label>
            <input
              id="name"
              name="name"
              defaultValue={values.name}
              required
              maxLength={160}
              placeholder="The Aulenback Family"
              className={`${inputClass} mt-1`}
            />
            <p className="mt-1 text-xs text-muted">
              Shown on the card and at the top of their RSVP page.
            </p>
            {state.fieldErrors?.name ? (
              <p role="alert" className="mt-1 text-sm text-red-700">
                {state.fieldErrors.name}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={values.email}
              maxLength={200}
              className={`${inputClass} mt-1`}
            />
            {state.fieldErrors?.email ? (
              <p role="alert" className="mt-1 text-sm text-red-700">
                {state.fieldErrors.email}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="phone" className={labelClass}>
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              defaultValue={values.phone}
              maxLength={40}
              className={`${inputClass} mt-1`}
            />
          </div>

          <div>
            <label htmlFor="tags" className={labelClass}>
              Tags
            </label>
            <input
              id="tags"
              name="tags"
              defaultValue={values.tags.join(", ")}
              placeholder="bride-family, work"
              className={`${inputClass} mt-1`}
            />
            <p className="mt-1 text-xs text-muted">
              Comma separated. Used for filtering.
            </p>
          </div>

          <div>
            <label htmlFor="plusOnesAllowed" className={labelClass}>
              Additional guests allowed
            </label>
            <select
              id="plusOnesAllowed"
              name="plusOnesAllowed"
              defaultValue={String(values.plusOnesAllowed)}
              className={`${inputClass} mt-1`}
            >
              {Array.from({ length: MAX_PLUS_ONES + 1 }, (_, count) => (
                <option key={count} value={count}>
                  {count === 0
                    ? "None"
                    : `${count} guest${count === 1 ? "" : "s"}`}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted">
              The party names them on their RSVP page. Lowering this removes the
              extra guests they already added.
            </p>
            {state.fieldErrors?.plusOnesAllowed ? (
              <p role="alert" className="mt-1 text-sm text-red-700">
                {state.fieldErrors.plusOnesAllowed}
              </p>
            ) : null}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="adminNotes" className={labelClass}>
              Private notes
            </label>
            <textarea
              id="adminNotes"
              name="adminNotes"
              rows={2}
              defaultValue={values.adminNotes}
              maxLength={2000}
              className={`${inputClass} mt-1 resize-y`}
            />
            <p className="mt-1 text-xs text-muted">
              Never shown to guests.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm uppercase tracking-[0.25em] text-muted">
            Guests
          </h2>
          <button
            type="button"
            onClick={() => setGuestRows((rows) => [...rows, { ...emptyGuest }])}
            className={secondaryButtonClass}
          >
            Add guest
          </button>
        </div>

        {state.fieldErrors?.guests ? (
          <p role="alert" className="mb-3 text-sm text-red-700">
            {state.fieldErrors.guests}
          </p>
        ) : null}

        <div className="flex flex-col gap-3">
          {guestRows.map((guest, index) => (
            <div
              key={guest.id ?? `new-${index}`}
              className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]"
            >
              <div>
                {index === 0 ? (
                  <label className={labelClass} htmlFor={`guest-first-${index}`}>
                    First name
                  </label>
                ) : null}
                <input
                  id={`guest-first-${index}`}
                  name="guest.firstName"
                  value={guest.firstName}
                  onChange={(event) =>
                    updateRow(index, { firstName: event.target.value })
                  }
                  maxLength={80}
                  className={`${inputClass} mt-1`}
                />
                <input type="hidden" name="guest.id" value={guest.id ?? ""} />
              </div>

              <div>
                {index === 0 ? (
                  <label className={labelClass} htmlFor={`guest-last-${index}`}>
                    Last name
                  </label>
                ) : null}
                <input
                  id={`guest-last-${index}`}
                  name="guest.lastName"
                  value={guest.lastName}
                  onChange={(event) =>
                    updateRow(index, { lastName: event.target.value })
                  }
                  maxLength={80}
                  className={`${inputClass} mt-1`}
                />
              </div>

              <button
                type="button"
                onClick={() => removeRow(index)}
                aria-label={`Remove guest ${index + 1}`}
                className="border border-accent/30 px-3 py-2 text-sm text-muted transition hover:border-red-400 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <p className="mt-3 text-xs text-muted">
          Named guests only. A plus one is added by the party on their RSVP page.
        </p>
      </Card>

      {state.status === "error" && state.message ? (
        <p role="alert" className="text-sm text-red-700">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create party"}
        </button>
        <Link
          href={isEdit ? `/admin/parties/${values.id}` : "/admin/parties"}
          className={secondaryButtonClass}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
