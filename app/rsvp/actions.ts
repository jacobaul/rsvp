"use server";

import { redirect } from "next/navigation";

import { RATE_LIMITS, rateLimit } from "@/lib/auth/rate-limit";
import { logEvent } from "@/lib/rsvp/activity";
import { formatCode, normalizeCode } from "@/lib/rsvp/codes";
import { getPartyByCode } from "@/lib/rsvp/queries";
import { getRequestContext, rateLimitKey } from "@/lib/rsvp/request-context";
import { codeSchema } from "@/lib/validation/rsvp";

export type LookupState = {
  error?: string;
  value?: string;
};

export async function lookupCode(
  _previous: LookupState,
  formData: FormData,
): Promise<LookupState> {
  const raw = String(formData.get("code") ?? "");
  const parsed = codeSchema.safeParse(raw);
  const { ip, userAgent } = await getRequestContext();

  const limit = rateLimit(
    rateLimitKey("code-lookup", ip),
    RATE_LIMITS.codeLookup.limit,
    RATE_LIMITS.codeLookup.windowMs,
  );

  if (!limit.allowed) {
    return {
      value: raw,
      error: "Too many attempts. Please wait a few minutes and try again.",
    };
  }

  if (!parsed.success) {
    return {
      value: raw,
      error: parsed.error.issues[0]?.message ?? "Check the code and try again.",
    };
  }

  const party = await getPartyByCode(parsed.data);

  if (!party) {
    await logEvent({
      type: "lookup_failed",
      ip,
      userAgent,
      path: "/rsvp",
      metadata: { attempted: normalizeCode(raw) },
    });

    return {
      value: raw,
      error:
        "We couldn't find that code. Check the card, or get in touch and we'll sort it out.",
    };
  }

  redirect(`/rsvp/${formatCode(party.code)}`);
}
