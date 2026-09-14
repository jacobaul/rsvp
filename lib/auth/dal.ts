import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { readSession, type SessionPayload } from "./session";

/**
 * The real authorization check. Proxy only does an optimistic cookie test, so
 * every admin page, server action, and route handler must call this.
 */
export const requireAdmin = cache(async (): Promise<SessionPayload> => {
  const session = await readSession();

  if (!session) {
    redirect("/admin/login");
  }

  return session;
});

/** Same check for route handlers, which return a response instead of redirecting. */
export async function requireAdminApi(): Promise<SessionPayload | null> {
  return readSession();
}

export const isAdmin = cache(async (): Promise<boolean> => {
  return (await readSession()) !== null;
});
