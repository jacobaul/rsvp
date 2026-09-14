import { redirect } from "next/navigation";

import { isAdmin } from "@/lib/auth/dal";

import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: PageProps<"/admin/login">) {
  if (await isAdmin()) {
    redirect("/admin");
  }

  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/admin";

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm border border-accent/25 bg-card px-8 py-10">
        <p className="text-sm uppercase tracking-[0.45em] text-accent">Admin</p>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl text-foreground">
          RSVP Management
        </h1>
        <p className="mt-4 text-sm leading-7 text-muted">
          Sign in to manage the invite list, codes, and responses.
        </p>

        <div className="mt-8">
          <LoginForm next={next} />
        </div>
      </div>
    </main>
  );
}
