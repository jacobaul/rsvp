/**
 * A `"use server"` file may only export async functions, so the RSVP form's
 * state type and initial value live here.
 */
export type RsvpFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const initialRsvpFormState: RsvpFormState = { status: "idle" };
