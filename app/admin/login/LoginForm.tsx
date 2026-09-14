"use client";

import { useActionState } from "react";

import { login, type LoginState } from "../actions/auth";

const initialState: LoginState = {};

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, initialState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <label
        htmlFor="password"
        className="text-sm uppercase tracking-[0.3em] text-muted"
      >
        Admin password
      </label>

      <input
        id="password"
        name="password"
        type="password"
        required
        autoFocus
        autoComplete="current-password"
        aria-invalid={state.error ? true : undefined}
        className="w-full border border-accent/40 bg-card px-4 py-3 text-base text-foreground focus:border-accent focus:outline-none"
      />

      {state.error ? (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full border border-accent bg-accent px-6 py-3 text-sm font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-accent-strong disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
