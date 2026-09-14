"use server";

import { RATE_LIMITS, rateLimit } from "@/lib/auth/rate-limit";
import { collectRsvpSubmission } from "@/lib/rsvp/form-data";
import { getPartyByCode } from "@/lib/rsvp/queries";
import { getRequestContext, rateLimitKey } from "@/lib/rsvp/request-context";
import { saveRsvpResponse } from "@/lib/rsvp/responses";
import { getSettings, rsvpIsEditable } from "@/lib/rsvp/settings";
import { formatCode } from "@/lib/rsvp/codes";
import { rsvpSubmissionSchema } from "@/lib/validation/rsvp";

import type { RsvpFormState } from "./form-state";

export async function submitRsvp(
  _previous: RsvpFormState,
  formData: FormData,
): Promise<RsvpFormState> {
  const { ip, userAgent } = await getRequestContext();
  const limit = rateLimit(
    rateLimitKey("rsvp-submit", ip),
    RATE_LIMITS.rsvpSubmit.limit,
    RATE_LIMITS.rsvpSubmit.windowMs,
  );

  if (!limit.allowed) {
    return {
      status: "error",
      message: "Too many submissions. Please wait a few minutes and try again.",
    };
  }

  const parsed = rsvpSubmissionSchema.safeParse(collectRsvpSubmission(formData));

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};

    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");

      if (!fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }

    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors,
    };
  }

  // Re-check the code server side; the hidden field is not trusted.
  const party = await getPartyByCode(parsed.data.code);

  if (!party) {
    return {
      status: "error",
      message: "We couldn't find that invitation. Try opening your link again.",
    };
  }

  const settings = await getSettings();

  if (!rsvpIsEditable(settings)) {
    return {
      status: "error",
      message: settings.rsvpOpen
        ? "The RSVP deadline has passed. Please contact us directly."
        : "RSVPs are not open yet.",
    };
  }

  if ((parsed.data.plusOnes ?? []).length > party.plusOnesAllowed) {
    return {
      status: "error",
      message:
        party.plusOnesAllowed === 0
          ? "This invitation does not include additional guests."
          : `This invitation includes up to ${party.plusOnesAllowed} additional guest${
              party.plusOnesAllowed === 1 ? "" : "s"
            }.`,
    };
  }

  const result = await saveRsvpResponse(party, parsed.data, {
    ip,
    userAgent,
    path: `/rsvp/${formatCode(party.code)}`,
    actor: "guest",
  });

  return {
    status: "success",
    message: result.isFirstResponse
      ? "Thank you. Your RSVP is in."
      : "Your response has been updated.",
  };
}
