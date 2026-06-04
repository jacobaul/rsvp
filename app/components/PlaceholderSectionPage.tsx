import Link from "next/link";

import { SiteNav } from "@/app/components/SiteNav";
import { SilverVinesBackground } from "@/app/components/SilverVinesBackground";

type PlaceholderSectionPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  details?: Array<{
    label: string;
    value: string;
  }>;
};

export function PlaceholderSectionPage({ eyebrow, title, description, details }: PlaceholderSectionPageProps) {
  return (
    <main className="relative flex flex-1 flex-col overflow-hidden px-6 py-8 sm:px-10 lg:px-16">
      <SilverVinesBackground />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col">
        <header className="flex flex-col gap-6 border-b border-accent/20 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-muted">Happily Ever After</p>
          </div>

          <SiteNav />
        </header>

        <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
          <div>
            <p className="text-sm uppercase tracking-[0.45em] text-accent">{eyebrow}</p>
            <h1 className="mt-6 max-w-3xl font-[family-name:var(--font-display)] text-6xl leading-[0.95] text-foreground sm:text-7xl">
              {title}
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-8 text-muted">{description}</p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/"
                className="border border-accent bg-accent px-6 py-3 text-center text-sm font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-accent-strong"
              >
                Return Home
              </Link>
              <Link
                href="/#details"
                className="border border-accent/30 px-6 py-3 text-center text-sm font-semibold uppercase tracking-[0.25em] text-foreground transition hover:border-accent"
              >
                View Details
              </Link>
            </div>
          </div>

          <div className="border border-accent/25 bg-card px-8 py-10 sm:px-10 sm:py-12">
            <p className="text-sm uppercase tracking-[0.45em] text-accent">Coming Soon</p>
            <p className="mt-6 font-[family-name:var(--font-display)] text-4xl text-foreground sm:text-5xl">
              More details will be shared soon.
            </p>
            <p className="mt-6 max-w-lg text-base leading-8 text-muted">
              We are still putting the final information together and will update this page as soon as everything is ready for guests.
            </p>

            {details?.length ? (
              <div className="mt-8 grid gap-6 sm:grid-cols-3">
                {details.map((item) => (
                  <div key={item.label} className="border-t border-accent/20 pt-4">
                    <p className="text-xs uppercase tracking-[0.35em] text-muted">{item.label}</p>
                    <p className="mt-3 text-lg leading-8 text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}