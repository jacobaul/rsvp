import "server-only";

import { requireAdminApi } from "@/lib/auth/dal";

/**
 * Route handlers are public endpoints. Returns a 401 response when the caller
 * has no valid admin session, or null when the request may proceed.
 */
export async function guardAdminRoute(): Promise<Response | null> {
  const session = await requireAdminApi();

  if (!session) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  return null;
}
