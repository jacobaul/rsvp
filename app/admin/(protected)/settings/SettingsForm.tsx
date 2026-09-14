"use client";

import { useActionState, useState } from "react";

import { saveSettings } from "../../actions/settings";
import {
  initialSettingsState,
  type SettingsState,
} from "../../actions/settings-state";
import {
  Card,
  buttonClass,
  inputClass,
  labelClass,
} from "../../components/ui";

type Props = {
  rsvpOpen: boolean;
  rsvpDeadline: string;
  siteUrl: string;
  ceremonyLabel: string;
  receptionLabel: string;
  ceremonyEnabled: boolean;
  receptionEnabled: boolean;
};

export function SettingsForm(props: Props) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    saveSettings,
    initialSettingsState,
  );

  const [rsvpOpen, setRsvpOpen] = useState(props.rsvpOpen);

  return (
    <form action={action} className="flex flex-col gap-6">
      <Card>
        <h2 className="mb-4 text-sm uppercase tracking-[0.25em] text-muted">
          Responses
        </h2>

        <label className="flex cursor-pointer items-center gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            name="rsvpOpen"
            checked={rsvpOpen}
            onChange={(event) => setRsvpOpen(event.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          RSVPs are open
        </label>
        <p className="mt-1 text-xs text-muted">
          When closed, a guest with a valid code sees a holding message instead
          of the form, and submissions are rejected.
        </p>

        <div className="mt-5 max-w-xs">
          <label htmlFor="rsvpDeadline" className={labelClass}>
            Deadline
          </label>
          <input
            id="rsvpDeadline"
            name="rsvpDeadline"
            type="date"
            defaultValue={props.rsvpDeadline}
            className={`${inputClass} mt-1`}
          />
          <p className="mt-1 text-xs text-muted">
            After this date guests see their answers read only. You can still
            edit on their behalf. Leave blank for no deadline.
          </p>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm uppercase tracking-[0.25em] text-muted">
          Site
        </h2>

        <div>
          <label htmlFor="siteUrl" className={labelClass}>
            Site URL
          </label>
          <input
            id="siteUrl"
            name="siteUrl"
            defaultValue={props.siteUrl}
            placeholder="https://wedding.example.com"
            className={`${inputClass} mt-1`}
          />
          <p className="mt-1 text-xs text-muted">
            Baked into every QR code. Set this before printing anything, and do
            not change it afterwards or printed cards will stop working.
          </p>
          {state.fieldErrors?.siteUrl ? (
            <p role="alert" className="mt-1 text-sm text-red-700">
              {state.fieldErrors.siteUrl}
            </p>
          ) : null}
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm uppercase tracking-[0.25em] text-muted">
          Events
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ceremonyLabel" className={labelClass}>
              Ceremony name
            </label>
            <input
              id="ceremonyLabel"
              name="ceremonyLabel"
              defaultValue={props.ceremonyLabel}
              maxLength={80}
              className={`${inputClass} mt-1`}
            />
            <label className="mt-2 flex cursor-pointer items-center gap-3 text-sm text-foreground">
              <input
                type="checkbox"
                name="ceremonyEnabled"
                defaultChecked={props.ceremonyEnabled}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              Ask about the ceremony
            </label>
          </div>

          <div>
            <label htmlFor="receptionLabel" className={labelClass}>
              Reception name
            </label>
            <input
              id="receptionLabel"
              name="receptionLabel"
              defaultValue={props.receptionLabel}
              maxLength={80}
              className={`${inputClass} mt-1`}
            />
            <label className="mt-2 flex cursor-pointer items-center gap-3 text-sm text-foreground">
              <input
                type="checkbox"
                name="receptionEnabled"
                defaultChecked={props.receptionEnabled}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              Ask about the reception
            </label>
          </div>
        </div>
      </Card>

      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={
            state.status === "error"
              ? "text-sm text-red-700"
              : "border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent-strong"
          }
        >
          {state.message}
        </p>
      ) : null}

      <div>
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}
