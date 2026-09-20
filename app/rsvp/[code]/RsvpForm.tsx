"use client";

import { useActionState, useState } from "react";

import type { RsvpStatusInput } from "@/lib/validation/rsvp";

import { submitRsvp } from "./actions";
import { initialRsvpFormState, type RsvpFormState } from "./form-state";

export type FormGuest = {
  id: number;
  name: string;
  rsvpStatus: RsvpStatusInput;
  dietaryNotes: string;
};

export type RsvpFormProps = {
  code: string;
  email: string;
  phone: string;
  guestMessage: string;
  guests: FormGuest[];
  /** How many extra guests this party may bring, 0 to 3. */
  plusOnesAllowed: number;
  plusOnes: FormGuest[];
  ceremonyLabel: string;
  receptionLabel: string;
  ceremonyEnabled: boolean;
  receptionEnabled: boolean;
};

/**
 * Venue times. The date and venue are hard-coded on the invite and schedule
 * pages too; these are not part of admin settings yet.
 */
const CEREMONY_TIME = "2:00 PM";
const RECEPTION_TIME = "6:00 PM";

const inputClass =
  "w-full border border-accent/30 bg-card px-3 py-2 text-base text-foreground placeholder:text-muted/60 focus:border-accent focus:outline-none";

function attendanceChoices(props: {
  ceremonyLabel: string;
  receptionLabel: string;
  ceremonyEnabled: boolean;
  receptionEnabled: boolean;
}): { value: RsvpStatusInput; label: string }[] {
  const both = props.ceremonyEnabled && props.receptionEnabled;
  const choices: { value: RsvpStatusInput; label: string }[] = [];

  if (both) {
    choices.push({
      value: "both",
      label: `${props.ceremonyLabel} at ${CEREMONY_TIME} and ${props.receptionLabel} at ${RECEPTION_TIME}`,
    });
  }

  if (props.ceremonyEnabled) {
    choices.push({
      value: "ceremony",
      label: both
        ? `${props.ceremonyLabel} only, at ${CEREMONY_TIME}`
        : `${props.ceremonyLabel} at ${CEREMONY_TIME}`,
    });
  }

  if (props.receptionEnabled) {
    choices.push({
      value: "reception",
      label: both
        ? `${props.receptionLabel} only, at ${RECEPTION_TIME}`
        : `${props.receptionLabel} at ${RECEPTION_TIME}`,
    });
  }

  choices.push({ value: "declined", label: "Unable to attend" });

  return choices;
}

type GuestFieldsProps = {
  namePrefix: string;
  heading: string;
  guest: FormGuest;
  choices: { value: RsvpStatusInput; label: string }[];
  error?: string;
};

function GuestFields({
  namePrefix,
  heading,
  guest,
  choices,
  error,
}: GuestFieldsProps) {
  const [status, setStatus] = useState<RsvpStatusInput>(guest.rsvpStatus);

  return (
    <fieldset className="border border-accent/25 bg-card/70 px-5 py-5 sm:px-6">
      <legend className="px-2 font-[family-name:var(--font-display)] text-2xl text-foreground">
        {heading}
      </legend>

      <div className="mt-2 flex flex-col gap-2">
        {choices.map((choice) => (
          <label
            key={choice.value}
            className="flex cursor-pointer items-center gap-3 text-base text-foreground"
          >
            <input
              type="radio"
              name={`${namePrefix}.rsvpStatus`}
              value={choice.value}
              checked={status === choice.value}
              onChange={() => setStatus(choice.value)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            {choice.label}
          </label>
        ))}
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {status !== "declined" ? (
        <div className="mt-4">
          <label
            htmlFor={`${namePrefix}.dietaryNotes`}
            className="block text-sm uppercase tracking-[0.2em] text-muted"
          >
            Allergies or dietary restrictions
          </label>
          <textarea
            id={`${namePrefix}.dietaryNotes`}
            name={`${namePrefix}.dietaryNotes`}
            defaultValue={guest.dietaryNotes}
            rows={2}
            maxLength={500}
            placeholder="Nut allergy, vegetarian, celiac, anything we should know"
            className={`${inputClass} mt-2 resize-y`}
          />
        </div>
      ) : null}
    </fieldset>
  );
}

export function RsvpForm(props: RsvpFormProps) {
  const [state, action, pending] = useActionState<RsvpFormState, FormData>(
    submitRsvp,
    initialRsvpFormState,
  );
  // One editable row per extra guest. Starts with whatever they saved before.
  const [plusOnes, setPlusOnes] = useState<FormGuest[]>(props.plusOnes);

  const addPlusOne = () => {
    setPlusOnes((current) =>
      current.length >= props.plusOnesAllowed
        ? current
        : [
            ...current,
            {
              id: 0,
              name: "",
              rsvpStatus: "both" as RsvpStatusInput,
              dietaryNotes: "",
            },
          ],
    );
  };

  const removePlusOne = (index: number) => {
    setPlusOnes((current) => current.filter((_, i) => i !== index));
  };

  const updatePlusOneName = (index: number, name: string) => {
    setPlusOnes((current) =>
      current.map((guest, i) => (i === index ? { ...guest, name } : guest)),
    );
  };

  const choices = attendanceChoices(props);

  if (state.status === "success") {
    return (
      <div className="border border-accent/40 bg-card px-6 py-8 sm:px-8">
        <p className="text-sm uppercase tracking-[0.45em] text-accent">
          All set
        </p>
        <p className="mt-4 font-[family-name:var(--font-display)] text-4xl text-foreground">
          {state.message}
        </p>
        <p className="mt-4 text-base leading-8 text-muted">
          You can change your answers any time before the deadline using the
          same link or code.
        </p>
        <a
          href={`/rsvp/${props.code}`}
          className="mt-6 inline-block border border-accent/40 px-5 py-2 text-sm font-semibold uppercase tracking-[0.25em] text-foreground transition hover:border-accent"
        >
          Edit response
        </a>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="code" value={props.code} />

      <div className="border border-accent/25 bg-card/70 px-5 py-5 sm:px-6">
        <p className="font-[family-name:var(--font-display)] text-2xl text-foreground">
          About dinner
        </p>
        <p className="mt-2 text-base leading-7 text-muted">
          Dinner is served buffet style, with vegetarian and gluten free
          options available. Please note any allergies or dietary restrictions
          below. Your answers help us give our caterer accurate numbers.
        </p>
      </div>

      {props.guests.map((guest, index) => (
        <div key={guest.id}>
          <input type="hidden" name="guestId" value={guest.id} />
          <GuestFields
            namePrefix={`guest.${guest.id}`}
            // A single guest is already named in the page heading, so repeating
            // it here adds nothing. Several guests need naming to tell apart.
            heading={props.guests.length === 1 ? "Will you be there?" : guest.name}
            guest={guest}
            choices={choices}
            error={state.fieldErrors?.[`guests.${index}.rsvpStatus`]}
          />
        </div>
      ))}

      {props.plusOnesAllowed > 0 ? (
        <div className="border border-accent/25 bg-card/70 px-5 py-5 sm:px-6">
          <p className="font-[family-name:var(--font-display)] text-2xl text-foreground">
            {props.plusOnesAllowed === 1
              ? "You may bring a guest"
              : `You may bring up to ${props.plusOnesAllowed} guests`}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted">
            Add their name and we will set a place for them. Leave this empty if
            you would rather come on your own.
          </p>

          <div className="mt-5 flex flex-col gap-5">
            {plusOnes.map((guest, index) => {
              const first = guest.name.split(" ")[0] ?? "";
              const last = guest.name.split(" ").slice(1).join(" ");

              return (
                <div
                  key={guest.id || `new-${index}`}
                  className="border border-accent/20 px-4 py-4"
                >
                  <input type="hidden" name="plusOne.id" value={guest.id || ""} />

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm uppercase tracking-[0.2em] text-muted">
                      Guest {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePlusOne(index)}
                      className="text-xs uppercase tracking-[0.15em] text-muted underline underline-offset-4 transition hover:text-foreground"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor={`plusOne-first-${index}`}
                        className="block text-sm uppercase tracking-[0.2em] text-muted"
                      >
                        First name
                      </label>
                      <input
                        id={`plusOne-first-${index}`}
                        name="plusOne.firstName"
                        value={first}
                        onChange={(event) =>
                          updatePlusOneName(
                            index,
                            `${event.target.value} ${last}`.trim(),
                          )
                        }
                        maxLength={80}
                        className={`${inputClass} mt-2`}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`plusOne-last-${index}`}
                        className="block text-sm uppercase tracking-[0.2em] text-muted"
                      >
                        Last name
                      </label>
                      <input
                        id={`plusOne-last-${index}`}
                        name="plusOne.lastName"
                        value={last}
                        onChange={(event) =>
                          updatePlusOneName(
                            index,
                            `${first} ${event.target.value}`.trim(),
                          )
                        }
                        maxLength={80}
                        className={`${inputClass} mt-2`}
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <GuestFields
                      namePrefix="plusOne"
                      heading="Will they be there?"
                      guest={guest}
                      choices={choices}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {plusOnes.length < props.plusOnesAllowed ? (
            <button
              type="button"
              onClick={addPlusOne}
              className="mt-4 border border-accent/40 px-5 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-foreground transition hover:border-accent"
            >
              {plusOnes.length === 0 ? "Add a guest" : "Add another guest"}
            </button>
          ) : (
            <p className="mt-4 text-sm text-muted">
              That is everyone your invitation allows.
            </p>
          )}
        </div>
      ) : (
        <div className="border border-accent/25 bg-card/70 px-5 py-5 sm:px-6">
          <p className="font-[family-name:var(--font-display)] text-2xl text-foreground">
            About additional guests
          </p>
          <p className="mt-2 text-base leading-7 text-muted">
            {props.guests.length === 1
              ? "Space at our venue is limited, so this invitation does not include a plus one. We hope you understand, and we cannot wait to celebrate with you."
              : "Space at our venue is limited, so we ask that guests be limited to those named above. If you think we have missed someone, please get in touch and we will do our best."}
          </p>
        </div>
      )}

      <div className="border border-accent/25 bg-card/70 px-5 py-5 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="email"
              className="block text-sm uppercase tracking-[0.2em] text-muted"
            >
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              defaultValue={props.email}
              maxLength={200}
              className={`${inputClass} mt-2`}
            />
            {state.fieldErrors?.email ? (
              <p role="alert" className="mt-2 text-sm text-red-700">
                {state.fieldErrors.email}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="phone"
              className="block text-sm uppercase tracking-[0.2em] text-muted"
            >
              Phone <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={props.phone}
              maxLength={40}
              className={`${inputClass} mt-2`}
            />
          </div>
        </div>

        <div className="mt-4">
          <label
            htmlFor="guestMessage"
            className="block text-sm uppercase tracking-[0.2em] text-muted"
          >
            A note for us{" "}
            <span className="normal-case tracking-normal">(optional)</span>
          </label>
          <textarea
            id="guestMessage"
            name="guestMessage"
            rows={3}
            defaultValue={props.guestMessage}
            maxLength={2000}
            className={`${inputClass} mt-2 resize-y`}
          />
        </div>
      </div>

      {state.status === "error" && state.message ? (
        <p role="alert" className="text-sm text-red-700">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full border border-accent bg-accent px-6 py-3 text-sm font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-accent-strong disabled:opacity-60 sm:w-auto sm:self-start"
      >
        {pending ? "Sending…" : "Send RSVP"}
      </button>
    </form>
  );
}
