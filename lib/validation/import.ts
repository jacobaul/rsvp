import { z } from "zod";

import { MAX_PLUS_ONES } from "@/lib/db/schema";
import { isValidCodeShape, normalizeCode } from "@/lib/rsvp/codes";

/**
 * Accepts a count ("2"), or the older yes/no spelling, which maps to 1 or 0.
 * Anything above the cap is clamped rather than rejected, so a spreadsheet
 * typo does not fail the whole import.
 */
const plusOneCount = z
  .string()
  .optional()
  .default("")
  .transform((value) => {
    const text = value.trim().toLowerCase();

    if (!text) {
      return 0;
    }

    if (["y", "yes", "true", "t"].includes(text)) {
      return 1;
    }

    if (["n", "no", "false", "f"].includes(text)) {
      return 0;
    }

    const parsed = Number(text);

    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }

    return Math.min(Math.floor(parsed), MAX_PLUS_ONES);
  });

export const importRowSchema = z.object({
  party: z.string().trim().min(1, "party is required").max(160),
  first_name: z.string().trim().min(1, "first_name is required").max(80),
  last_name: z.string().trim().max(80).optional().default(""),
  plus_ones_allowed: plusOneCount,
  // Legacy header from the first version of the template.
  plus_one_allowed: plusOneCount,
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .default("")
    .refine(
      (value) => value === "" || z.email().safeParse(value).success,
      "email is not a valid address",
    ),
  phone: z.string().trim().max(40).optional().default(""),
  tags: z.string().trim().max(300).optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
  code: z
    .string()
    .trim()
    .optional()
    .default("")
    .transform((value) => (value ? normalizeCode(value) : ""))
    .refine(
      (value) => value === "" || isValidCodeShape(value),
      "code is not a valid 8-character code",
    ),
});

export type ImportRow = z.infer<typeof importRowSchema>;

export const IMPORT_COLUMNS = [
  "party",
  "first_name",
  "last_name",
  "plus_ones_allowed",
  "email",
  "phone",
  "tags",
  "notes",
  "code",
] as const;

export const CONFLICT_MODES = ["skip", "update", "replace"] as const;
export type ConflictMode = (typeof CONFLICT_MODES)[number];
