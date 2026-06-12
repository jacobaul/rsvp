import Image from "next/image";
import Link from "next/link";

import { SilverVinesBackground } from "@/app/components/SilverVinesBackground";
import { SiteNav } from "@/app/components/SiteNav";

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col overflow-hidden px-6 py-8 sm:px-10 lg:px-16">
      <SilverVinesBackground />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col">
        <header className="flex flex-col gap-5 border-b border-accent/20 pb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div className="text-center sm:text-left">
            <p className="font-[family-name:var(--font-display)] text-2xl tracking-[0.08em] text-foreground/85 sm:text-sm sm:uppercase sm:tracking-[0.35em] sm:text-muted">
              Happily Ever After
            </p>
            {/* <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl text-foreground sm:text-5xl">
             
            </h1> */}
          </div>

          <SiteNav />
        </header>

        <section className="grid flex-1 gap-10 py-12 lg:items-center lg:grid-cols-[1.1fr_0.9fr] lg:py-16">
          <div className="text-glow-panel flex flex-col justify-center px-6 py-8 sm:px-8">
            <p className="text-sm uppercase tracking-[0.45em] text-accent">The Wedding of</p>
            <h2 className="mt-6 max-w-3xl font-[family-name:var(--font-display)] text-6xl leading-[0.95] text-foreground sm:text-7xl">
              Felicia Morgan &amp; Jacob Aulenback
            </h2>
            <p className="mt-8 max-w-xl text-lg leading-8 text-muted">
              The pleasure of your company is requested at the wedding of Felicia Morgan &amp; Jacob Aulenback on <strong className="font-semibold text-foreground">Saturday, January 9th, 2027</strong> at{" "}
              <a
                href="https://maps.app.goo.gl/veZERSgR99bXjwLy8"
                target="_blank"
                rel="noreferrer"
                className="text-inherit"
              >
                Esquimalt Gorge Pavilion in Victoria, BC
              </a>
              .
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/rsvp"
                className="border border-accent bg-accent px-6 py-3 text-center text-sm font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-accent-strong"
              >
                RSVP Coming Soon
              </Link>
              <Link
                href="/schedule"
                className="border border-accent/30 px-6 py-3 text-center text-sm font-semibold uppercase tracking-[0.25em] text-foreground transition hover:border-accent"
              >
                View Details
              </Link>
            </div>
          </div>

          <div className="relative aspect-[4/5] w-full max-w-[34rem] justify-self-center overflow-hidden border border-accent/25 bg-card lg:justify-self-end">
            <Image
              src="/10_Jacob_Disney_Proposal_.jpg"
              alt="Engagement photo"
              fill
              sizes="(max-width: 1024px) 100vw, 34rem"
              className="object-cover"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
