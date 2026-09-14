import { z } from "zod";

import { MAX_PLUS_ONES } from "@/lib/db/schema";
import { rsvpStatusSchema } from "./rsvp";

export const guestRowSchema = z.object({
  id: z.coerce.number().int().optional(),
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().max(80).optional().default(""),
  rsvpStatus: rsvpStatusSchema.optional().default("pending"),
  dietaryNotes: z.string().trim().max(500).optional().default(""),
});

/** Comma or newline separated in the UI; stored as a Postgres text[]. */
export const tagsSchema = z
  .string()
  .optional()
  .default("")
  .transform((value) =>
    Array.from(
      new Set(
        value
          .split(/[,\n]/)
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean),
      ),
    ).slice(0, 20),
  );

export const partyFormSchema = z.object({
  name: z.string().trim().min(1, "Party name is required").max(160),
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .default("")
    .refine(
      (value) => value === "" || z.email().safeParse(value).success,
      "Enter a valid email address",
    ),
  phone: z.string().trim().max(40).optional().default(""),
  plusOnesAllowed: z.coerce
    .number()
    .int()
    .min(0, "Cannot be negative")
    .max(MAX_PLUS_ONES, `At most ${MAX_PLUS_ONES} extra guests per party`)
    .optional()
    .default(0),
  tags: tagsSchema,
  adminNotes: z.string().trim().max(2000).optional().default(""),
  guestMessage: z.string().trim().max(2000).optional().default(""),
  guests: z.array(guestRowSchema).min(1, "Add at least one guest"),
});

export type PartyFormInput = z.infer<typeof partyFormSchema>;
export type GuestRowInput = z.infer<typeof guestRowSchema>;
