import { z } from "zod";

import { MAX_PLUS_ONES } from "@/lib/db/schema";
import { isValidCodeShape, normalizeCode } from "@/lib/rsvp/codes";

export const rsvpStatusSchema = z.enum([
  "pending",
  "both",
  "ceremony",
  "reception",
  "declined",
]);

export type RsvpStatusInput = z.infer<typeof rsvpStatusSchema>;

export function attendsReception(status: RsvpStatusInput): boolean {
  return status === "both" || status === "reception";
}

export function attendsCeremony(status: RsvpStatusInput): boolean {
  return status === "both" || status === "ceremony";
}

export function isAttending(status: RsvpStatusInput): boolean {
  return status !== "pending" && status !== "declined";
}

export const codeSchema = z
  .string()
  .trim()
  .min(1, "Enter the code from your invitation")
  .transform(normalizeCode)
  .refine(isValidCodeShape, "That code doesn't look right. Check the card.");

export const guestAnswerSchema = z.object({
  guestId: z.coerce.number().int().positive(),
  rsvpStatus: rsvpStatusSchema.refine(
    (value) => value !== "pending",
    "Choose an option for each guest",
  ),
  dietaryNotes: z.string().trim().max(500).optional().default(""),
});

export const plusOneSchema = z.object({
  /** Present when editing a plus one the party already added. */
  id: z.coerce.number().int().positive().optional(),
  firstName: z.string().trim().max(80).optional().default(""),
  lastName: z.string().trim().max(80).optional().default(""),
  rsvpStatus: rsvpStatusSchema.optional().default("both"),
  dietaryNotes: z.string().trim().max(500).optional().default(""),
});

export const rsvpSubmissionSchema = z.object({
  code: codeSchema,
  email: z.email("Enter a valid email address").max(200),
  phone: z.string().trim().max(40).optional().default(""),
  guestMessage: z.string().trim().max(2000).optional().default(""),
  guests: z.array(guestAnswerSchema).min(1, "No guests to respond for"),
  plusOnes: z.array(plusOneSchema).max(MAX_PLUS_ONES).optional(),
});

export type RsvpSubmission = z.infer<typeof rsvpSubmissionSchema>;
export type GuestAnswer = z.infer<typeof guestAnswerSchema>;
export type PlusOneAnswer = z.infer<typeof plusOneSchema>;

export { MAX_PLUS_ONES };

export const RSVP_STATUS_LABELS: Record<RsvpStatusInput, string> = {
  pending: "No answer yet",
  both: "Ceremony and reception",
  ceremony: "Ceremony only",
  reception: "Reception only",
  declined: "Unable to attend",
};
