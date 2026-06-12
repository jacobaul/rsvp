import { ReactNode } from "react";

import { SilverVinesBackground } from "@/app/components/SilverVinesBackground";
import { SiteNav } from "@/app/components/SiteNav";

type SectionPageLayoutProps = {
  eyebrow: string;
  title: string;
  body?: ReactNode;
  aside?: ReactNode;
  titleClassName?: string;
};

export function SectionPageLayout({ eyebrow, title, body, aside, titleClassName }: SectionPageLayoutProps) {
  return (
    <main className="relative flex flex-1 flex-col overflow-hidden px-6 py-8 sm:px-10 lg:px-16">
      <SilverVinesBackground />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col">
        <header className="flex flex-col gap-5 border-b border-accent/20 pb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div className="text-center sm:text-left">
            <p className="font-[family-name:var(--font-display)] text-2xl tracking-[0.08em] text-foreground/85 sm:text-sm sm:uppercase sm:tracking-[0.35em] sm:text-muted">
              Happily Ever After
            </p>
          </div>

          <SiteNav />
        </header>

        <section className="grid flex-1 items-center gap-10 pt-4 pb-8 lg:grid-cols-[1.05fr_0.95fr] lg:pb-10 lg:pt-4">
          <div className="text-glow-panel px-4 py-6 sm:px-8 sm:py-8 lg:px-0">
            <p className="text-sm uppercase tracking-[0.45em] text-accent">{eyebrow}</p>
            <h1
              className={`mt-6 max-w-3xl font-[family-name:var(--font-display)] leading-[0.95] text-foreground ${titleClassName ?? "text-6xl sm:text-7xl"}`}
            >
              {title}
            </h1>

            {body ? <div className="mt-8">{body}</div> : null}
          </div>

          {aside ?? <div />}
        </section>
      </div>
    </main>
  );
}