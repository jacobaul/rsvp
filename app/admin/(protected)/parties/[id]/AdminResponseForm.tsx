"use client";

import { useActionState, useState } from "react";

import { RSVP_STATUS_LABELS, type RsvpStatusInput } from "@/lib/validation/rsvp";

import { adminSaveResponseAction } from "../../../actions/parties";
import {
  initialPartyFormState,
  type PartyFormState,
} from "../../../actions/form-state";
import { buttonClass, inputClass, labelClass } from "../../../components/ui";

type FormGuest = {
  id: number;
  name: string;
  rsvpStatus: RsvpStatusInput;
  dietaryNotes: string;
};

const STATUS_ORDER: RsvpStatusInput[] = [
  "pending",
  "both",
  "ceremony",
  "reception",
  "declined",
];

function GuestRow({
  prefix,
  guest,
}: {
  prefix: string;
  guest: FormGuest;
}) {
  const [status, setStatus] = useState<RsvpStatusInput>(guest.rsvpStatus);

  return (
    <div className="grid gap-3 border-b border-accent/15 pb-3 last:border-0 sm:grid-cols-[1fr_1fr]">
      <div>
        <span className="text-sm font-medium text-foreground">{guest.name}</span>
      </div>

      <div>
        <label htmlFor={`${prefix}.rsvpStatus`} className="sr-only">
          Attendance for {guest.name}
        </label>
        <select
          id={`${prefix}.rsvpStatus`}
          name={`${prefix}.rsvpStatus`}
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as RsvpStatusInput)
          }
          className={inputClass}
        >
          {STATUS_ORDER.map((value) => (
            <option key={value} value={value}>
              {RSVP_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="sm:col-span-2">
        <label htmlFor={`${prefix}.dietaryNotes`} className="sr-only">
          Allergies or dietary restrictions for {guest.name}
        </label>
        <input
          id={`${prefix}.dietaryNotes`}
          name={`${prefix}.dietaryNotes`}
          defaultValue={guest.dietaryNotes}
          placeholder="Allergies or dietary restrictions"
          maxLength={500}
          className={inputClass}
        />
      </div>
    </div>
  );
}

export function AdminResponseForm({
  partyId,
  email,
  phone,
  guestMessage,
  guests,
  plusOnesAllowed,
  plusOnes: initialPlusOnes,
}: {
  partyId: number;
  email: string;
  phone: string;
  guestMessage: string;
  guests: FormGuest[];
  plusOnesAllowed: number;
  plusOnes: FormGuest[];
  ceremonyLabel: string;
  receptionLabel: string;
}) {
  const [state, action, pending] = useActionState<PartyFormState, FormData>(
    adminSaveResponseAction,
    initialPartyFormState,
  );
  const [extraGuests, setExtraGuests] = useState<FormGuest[]>(initialPlusOnes);

  const updateName = (index: number, name: string) => {
    setExtraGuests((current) =>
      current.map((guest, i) => (i === index ? { ...guest, name } : guest)),
    );
  };

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="partyId" value={partyId} />
      <input type="hidden" name="guestMessage" value={guestMessage} />

      <div className="flex flex-col gap-3">
        {guests.map((guest) => (
          <GuestRow
            key={guest.id}
            prefix={`guest.${guest.id}`}
            guest={guest}
          />
        ))}
      </div>

      {plusOnesAllowed > 0 ? (
        <div className="border border-accent/20 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">
            Additional guests ({extraGuests.length} of {plusOnesAllowed})
          </p>

          <div className="mt-3 flex flex-col gap-4">
            {extraGuests.map((guest, index) => {
              const first = guest.name.split(" ")[0] ?? "";
              const last = guest.name.split(" ").slice(1).join(" ");

              return (
                <div
                  key={guest.id || `new-${index}`}
                  className="border-b border-accent/15 pb-3 last:border-0"
                >
                  <input type="hidden" name="plusOne.id" value={guest.id || ""} />

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted">
                      Guest {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setExtraGuests((current) =>
                          current.filter((_, i) => i !== index),
                        )
                      }
                      className="text-xs uppercase tracking-[0.15em] text-muted underline underline-offset-4 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <input
                      name="plusOne.firstName"
                      value={first}
                      onChange={(event) =>
                        updateName(index, `${event.target.value} ${last}`.trim())
                      }
                      placeholder="First name"
                      maxLength={80}
                      className={inputClass}
                    />
                    <input
                      name="plusOne.lastName"
                      value={last}
                      onChange={(event) =>
                        updateName(index, `${first} ${event.target.value}`.trim())
                      }
                      placeholder="Last name"
                      maxLength={80}
                      className={inputClass}
                    />
                  </div>

                  <div className="mt-3">
                    <GuestRow
                      prefix="plusOne"
                      guest={{ ...guest, name: first || "Their guest" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {extraGuests.length < plusOnesAllowed ? (
            <button
              type="button"
              onClick={() =>
                setExtraGuests((current) => [
                  ...current,
                  {
                    id: 0,
                    name: "",
                    rsvpStatus: "both" as RsvpStatusInput,
                    dietaryNotes: "",
                  },
                ])
              }
              className="mt-3 text-xs uppercase tracking-[0.15em] text-accent-strong underline underline-offset-4"
            >
              Add guest
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="response-email" className={labelClass}>
            Email
          </label>
          <input
            id="response-email"
            name="email"
            type="email"
            defaultValue={email}
            required
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
          <label htmlFor="response-phone" className={labelClass}>
            Phone
          </label>
          <input
            id="response-phone"
            name="phone"
            defaultValue={phone}
            maxLength={40}
            className={`${inputClass} mt-1`}
          />
        </div>
      </div>

      {state.status === "error" && state.message ? (
        <p role="alert" className="text-sm text-red-700">
          {state.message}
        </p>
      ) : null}

      <div>
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save response"}
        </button>
        <p className="mt-2 text-xs text-muted">
          Saved changes are recorded in the activity log as an admin edit.
        </p>
      </div>
    </form>
  );
}
