import type { ReactNode } from "react";

import { requireAdmin } from "@/lib/auth/dal";

import { AdminNav } from "./AdminNav";
import { logout } from "../actions/auth";

/**
 * Every admin page reads cookies through requireAdmin(), which already makes
 * them request-rendered. This is a belt-and-braces guard so no admin route can
 * ever be captured at build time, when no database is reachable.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "RSVP Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <header className="border-b border-accent/20 bg-card/60 px-6 py-4 sm:px-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-baseline gap-4">
            <span className="font-[family-name:var(--font-display)] text-2xl text-foreground">
              RSVP Admin
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <AdminNav />
            <form action={logout}>
              <button
                type="submit"
                className="text-sm uppercase tracking-[0.15em] text-muted transition hover:text-foreground"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8 sm:px-10">
        {children}
      </main>
    </div>
  );
}
