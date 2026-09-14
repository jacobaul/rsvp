"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/dal";
import {
  collectAdminGuestAnswers,
  collectGuestRows,
  collectPlusOnes,
} from "@/lib/rsvp/form-data";
import {
  createParty,
  deleteParty,
  regenerateCode,
  regenerateCodesForParties,
  updateParty,
} from "@/lib/rsvp/parties";
import { getPartyById } from "@/lib/rsvp/queries";
import { saveRsvpResponse } from "@/lib/rsvp/responses";
import { partyFormSchema } from "@/lib/validation/party";
import { rsvpSubmissionSchema } from "@/lib/validation/rsvp";

import type { PartyFormState } from "./form-state";

function parsePartyForm(formData: FormData) {
  return partyFormSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    plusOneAllowed: formData.get("plusOneAllowed") === "on",
    tags: String(formData.get("tags") ?? ""),
    adminNotes: String(formData.get("adminNotes") ?? ""),
    guestMessage: String(formData.get("guestMessage") ?? ""),
    guests: collectGuestRows(formData),
  });
}

function toFieldErrors(
  issues: { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of issues) {
    const key = issue.path.map(String).join(".");

    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }

  return fieldErrors;
}

export async function createPartyAction(
  _previous: PartyFormState,
  formData: FormData,
): Promise<PartyFormState> {
  await requireAdmin();

  const parsed = parsePartyForm(formData);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  const party = await createParty(parsed.data);

  revalidatePath("/admin/parties");
  redirect(`/admin/parties/${party.id}`);
}

export async function updatePartyAction(
  _previous: PartyFormState,
  formData: FormData,
): Promise<PartyFormState> {
  await requireAdmin();

  const id = Number(formData.get("partyId"));
  const existing = await getPartyById(id);

  if (!existing) {
    return { status: "error", message: "That party no longer exists." };
  }

  const parsed = parsePartyForm(formData);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  await updateParty(existing, parsed.data);

  revalidatePath("/admin/parties");
  revalidatePath(`/admin/parties/${id}`);
  redirect(`/admin/parties/${id}?saved=1`);
}

export async function deletePartyAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = Number(formData.get("partyId"));
  const party = await getPartyById(id);

  if (!party) {
    redirect("/admin/parties");
  }

  await deleteParty(party.id, party.name);

  revalidatePath("/admin/parties");
  redirect("/admin/parties?deleted=1");
}

export async function regenerateCodeAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = Number(formData.get("partyId"));

  if (!Number.isInteger(id)) {
    redirect("/admin/parties");
  }

  await regenerateCode(id);

  revalidatePath(`/admin/parties/${id}`);
  redirect(`/admin/parties/${id}?code=1`);
}

export async function bulkRegenerateCodesAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const ids = formData
    .getAll("partyIds")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  const count = await regenerateCodesForParties(ids);

  revalidatePath("/admin/parties");
  redirect(`/admin/parties?regenerated=${count}`);
}

/** Admin filling in an RSVP taken over the phone. */
export async function adminSaveResponseAction(
  _previous: PartyFormState,
  formData: FormData,
): Promise<PartyFormState> {
  await requireAdmin();

  const id = Number(formData.get("partyId"));
  const party = await getPartyById(id);

  if (!party) {
    return { status: "error", message: "That party no longer exists." };
  }

  const named = party.guests.filter((guest) => guest.kind === "named");

  const parsed = rsvpSubmissionSchema.safeParse({
    code: party.code,
    email: String(formData.get("email") ?? party.email ?? ""),
    phone: String(formData.get("phone") ?? ""),
    guestMessage: String(formData.get("guestMessage") ?? ""),
    guests: collectAdminGuestAnswers(
      formData,
      named.map((guest) => guest.id),
      new Map(named.map((guest) => [guest.id, guest.rsvpStatus])),
    ),
    plusOnes: collectPlusOnes(formData),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  await saveRsvpResponse(party, parsed.data, {
    actor: "admin",
    path: `/admin/parties/${id}`,
  });

  revalidatePath(`/admin/parties/${id}`);
  redirect(`/admin/parties/${id}?saved=1`);
}
