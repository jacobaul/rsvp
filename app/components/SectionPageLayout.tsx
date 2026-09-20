import { ReactNode } from "react";

import { SilverVinesBackground } from "@/app/components/SilverVinesBackground";
import { SiteNav } from "@/app/components/SiteNav";

type SectionPageLayoutProps = {
  eyebrow: string;
  title: string;
  body?: ReactNode;
  aside?: ReactNode;
  titleClassName?: string;
  /**
   * Put the aside between the title and the body on small screens, where the
   * two columns stack. The aside is rendered in both slots with the inactive
   * one set to display:none, so it is never read out twice.
   */
  asideFirstOnMobile?: boolean;
};

export function SectionPageLayout({
  eyebrow,
  title,
  body,
  aside,
  titleClassName,
  asideFirstOnMobile = false,
}: SectionPageLayoutProps) {
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

        {/* With no aside there is no second column to balance against, so the
            single column is centred instead of being left in place. */}
        <section
          className={`grid flex-1 items-center gap-10 pt-4 pb-8 lg:pb-10 lg:pt-4 ${
            aside ? "lg:grid-cols-[1.05fr_0.95fr]" : ""
          }`}
        >
          <div
            className={`text-glow-panel px-4 py-6 sm:px-8 sm:py-8 lg:px-0 ${
              aside ? "" : "mx-auto w-full max-w-2xl text-center lg:px-8"
            }`}
          >
            {eyebrow ? (
              <p className="text-sm uppercase tracking-[0.45em] text-accent">{eyebrow}</p>
            ) : null}
            <h1
              className={`max-w-3xl font-[family-name:var(--font-display)] leading-[0.95] text-foreground ${
                eyebrow ? "mt-6" : ""
              } ${aside ? "" : "mx-auto"} ${titleClassName ?? "text-6xl sm:text-7xl"}`}
            >
              {title}
            </h1>

            {asideFirstOnMobile && aside ? (
              <div className="mt-8 lg:hidden">{aside}</div>
            ) : null}

            {body ? <div className="mt-8">{body}</div> : null}
          </div>

          {aside ? (
            <div className={asideFirstOnMobile ? "hidden lg:block" : undefined}>
              {aside}
            </div>
          ) : (
            <div />
          )}
        </section>
      </div>
    </main>
  );
}