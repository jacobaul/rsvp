"use client";

import { useActionState } from "react";

import { lookupCode, type LookupState } from "./actions";

const initialState: LookupState = {};

export function CodeEntryForm() {
  const [state, action, pending] = useActionState(lookupCode, initialState);

  return (
    <form action={action} className="mt-8 flex flex-col gap-4">
      <label
        htmlFor="code"
        className="text-sm uppercase tracking-[0.3em] text-muted"
      >
        Invitation code
      </label>

      <input
        id="code"
        name="code"
        defaultValue={state.value}
        placeholder="ABCD-EFGH"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        required
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "code-error" : undefined}
        className="w-full max-w-sm border border-accent/40 bg-card px-4 py-3 font-[family-name:var(--font-display)] text-2xl tracking-[0.3em] text-foreground uppercase placeholder:text-muted/50 focus:border-accent focus:outline-none"
      />

      {state.error ? (
        <p id="code-error" role="alert" className="max-w-sm text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full max-w-sm border border-accent bg-accent px-6 py-3 text-sm font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-accent-strong disabled:opacity-60"
      >
        {pending ? "Looking up…" : "Find my invitation"}
      </button>
    </form>
  );
}
