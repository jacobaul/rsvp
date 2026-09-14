/**
 * Shared form state for the admin actions.
 *
 * A `"use server"` file may only export async functions, so the state type and
 * its initial value live here instead of alongside the actions.
 */
export type PartyFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const initialPartyFormState: PartyFormState = { status: "idle" };
