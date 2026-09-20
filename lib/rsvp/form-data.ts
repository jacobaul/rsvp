import type { RsvpStatusInput } from "@/lib/validation/rsvp";
import type { GuestRowInput } from "@/lib/validation/party";

/**
 * Pure FormData readers shared by the server actions.
 *
 * These live outside the `"use server"` files so they can be unit tested
 * without a request, and so the shape the browser posts is pinned down by
 * tests rather than by reading the JSX.
 */

function text(formData: FormData, key: string, fallback = ""): string {
  const value = formData.get(key);

  return typeof value === "string" ? value : fallback;
}

/**
 * The guest RSVP form posts one `guestId` per guest plus fields namespaced by
 * that id, so a party of any size works with no client-side state.
 */
export function collectGuestAnswers(formData: FormData): {
  guestId: number;
  rsvpStatus: RsvpStatusInput;
  dietaryNotes: string;
}[] {
  const ids = formData
    .getAll("guestId")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  // A duplicated id would otherwise produce two conflicting answers.
  const unique = Array.from(new Set(ids));

  return unique.map((guestId) => ({
    guestId,
    rsvpStatus: (text(formData, `guest.${guestId}.rsvpStatus`) ||
      "pending") as RsvpStatusInput,
    dietaryNotes: text(formData, `guest.${guestId}.dietaryNotes`),
  }));
}

/**
 * Extra guests post as parallel arrays, one entry per slot the party filled in.
 * A row with no name at all means "I removed this guest" and is dropped here;
 * the allowance itself is enforced server side against the party record.
 */
export function collectPlusOnes(formData: FormData) {
  const ids = formData.getAll("plusOne.id");
  const firstNames = formData.getAll("plusOne.firstName");
  const lastNames = formData.getAll("plusOne.lastName");
  const statuses = formData.getAll("plusOne.rsvpStatus");
  const notes = formData.getAll("plusOne.dietaryNotes");

  const rows = [];

  for (let index = 0; index < firstNames.length; index += 1) {
    const firstName = String(firstNames[index] ?? "").trim();
    const lastName = String(lastNames[index] ?? "").trim();

    if (!firstName && !lastName) {
      continue;
    }

    const rawId = String(ids[index] ?? "").trim();
    const id = rawId ? Number(rawId) : undefined;

    rows.push({
      id: Number.isInteger(id) && (id as number) > 0 ? id : undefined,
      firstName,
      lastName,
      rsvpStatus: (String(statuses[index] ?? "both") ||
        "both") as RsvpStatusInput,
      dietaryNotes: String(notes[index] ?? ""),
    });
  }

  return rows;
}

export function collectRsvpSubmission(formData: FormData) {
  return {
    code: text(formData, "code"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    guestMessage: text(formData, "guestMessage"),
    guests: collectGuestAnswers(formData),
    plusOnes: collectPlusOnes(formData),
  };
}

/**
 * The whole admin party editor payload.
 *
 * Kept here rather than inline in the action so the mapping is covered by
 * tests. A key that drifts out of step with the schema is invisible to
 * TypeScript, because safeParse takes `unknown`, and a field with a default
 * then fills itself in silently instead of failing.
 */
export function collectPartyForm(formData: FormData) {
  return {
    name: text(formData, "name"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    plusOnesAllowed: Number(text(formData, "plusOnesAllowed", "0") || "0"),
    tags: text(formData, "tags"),
    adminNotes: text(formData, "adminNotes"),
    guestMessage: text(formData, "guestMessage"),
    guests: collectGuestRows(formData),
  };
}

/**
 * The admin party editor posts guest fields as parallel arrays. A row with
 * both names blank is how the admin deletes a guest, so it is dropped here.
 */
export function collectGuestRows(formData: FormData): GuestRowInput[] {
  const ids = formData.getAll("guest.id");
  const firstNames = formData.getAll("guest.firstName");
  const lastNames = formData.getAll("guest.lastName");
  const statuses = formData.getAll("guest.rsvpStatus");
  const notes = formData.getAll("guest.dietaryNotes");

  const rows: GuestRowInput[] = [];

  for (let index = 0; index < firstNames.length; index += 1) {
    const firstName = String(firstNames[index] ?? "").trim();
    const lastName = String(lastNames[index] ?? "").trim();

    if (!firstName && !lastName) {
      continue;
    }

    const rawId = String(ids[index] ?? "").trim();
    const id = rawId ? Number(rawId) : undefined;

    rows.push({
      id: Number.isInteger(id) && (id as number) > 0 ? id : undefined,
      firstName,
      lastName,
      rsvpStatus: (String(statuses[index] ?? "pending") ||
        "pending") as RsvpStatusInput,
      dietaryNotes: String(notes[index] ?? ""),
    });
  }

  return rows;
}

/** Admin-side RSVP editing addresses guests by the ids already on the party. */
export function collectAdminGuestAnswers(
  formData: FormData,
  guestIds: number[],
  currentStatus: Map<number, RsvpStatusInput>,
) {
  return guestIds.map((guestId) => ({
    guestId,
    rsvpStatus: (text(formData, `guest.${guestId}.rsvpStatus`) ||
      currentStatus.get(guestId) ||
      "pending") as RsvpStatusInput,
    dietaryNotes: text(formData, `guest.${guestId}.dietaryNotes`),
  }));
}
