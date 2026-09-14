"use server";

import { redirect } from "next/navigation";

import { RATE_LIMITS, rateLimit, resetRateLimit } from "@/lib/auth/rate-limit";
import { isValidHashFormat, verifyPassword } from "@/lib/auth/password";
import { createSession, deleteSession } from "@/lib/auth/session";
import { getRequestContext, rateLimitKey } from "@/lib/rsvp/request-context";

export type LoginState = {
  error?: string;
};

/** Only same-origin relative paths, so `?next=` cannot become an open redirect. */
function safeNextPath(value: FormDataEntryValue | null): string {
  const raw = typeof value === "string" ? value : "";

  if (!raw.startsWith("/admin") || raw.startsWith("//")) {
    return "/admin";
  }

  return raw;
}

export async function login(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  const destination = safeNextPath(formData.get("next"));
  const { ip } = await getRequestContext();
  const key = rateLimitKey("admin-login", ip);

  const limit = rateLimit(
    key,
    RATE_LIMITS.adminLogin.limit,
    RATE_LIMITS.adminLogin.windowMs,
  );

  if (!limit.allowed) {
    return {
      error: `Too many attempts. Try again in ${Math.ceil(
        limit.retryAfterSeconds / 60,
      )} minutes.`,
    };
  }

  const stored = process.env.ADMIN_PASSWORD_HASH;

  if (!stored) {
    return {
      error:
        "ADMIN_PASSWORD_HASH is not set on the server. Run: pnpm admin:password 'your-password'",
    };
  }

  // A hash that reached the process damaged would otherwise look exactly like
  // a wrong password, so say what actually happened.
  if (!isValidHashFormat(stored)) {
    return {
      error:
        "ADMIN_PASSWORD_HASH on the server is not a valid hash. Regenerate it with: pnpm admin:password 'your-password'",
    };
  }

  const valid = await verifyPassword(password, stored);

  if (!valid) {
    return { error: "That password is not right." };
  }

  resetRateLimit(key);
  await createSession();
  redirect(destination);
}

export async function logout() {
  await deleteSession();
  redirect("/admin/login");
}
