import { z } from "zod";

export const settingsSchema = z.object({
  rsvpOpen: z.boolean(),
  rsvpDeadline: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null))
    .refine(
      (value) => value === null || !Number.isNaN(Date.parse(value)),
      "Enter a valid date",
    ),
  siteUrl: z
    .string()
    .trim()
    .max(300)
    .refine(
      (value) => value === "" || /^https?:\/\/.+/.test(value),
      "Enter a full URL including http:// or https://",
    ),
  ceremonyLabel: z.string().trim().min(1, "Required").max(80),
  receptionLabel: z.string().trim().min(1, "Required").max(80),
  ceremonyEnabled: z.boolean(),
  receptionEnabled: z.boolean(),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
