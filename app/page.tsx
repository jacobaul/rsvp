import Link from "next/link";

import { SilverVinesBackground } from "@/app/components/SilverVinesBackground";
import { SiteNav } from "@/app/components/SiteNav";

export default function Home() {
  const details = [
    {
      label: "Date",
      value: "Saturday, January 9th, 2027",
    },
    {
      label: "Location",
      value: "Esquimalt Gorge Pavilion, Victoria, BC",
    },
    {
      label: "Events",
      value: "Ceremony, dinner, and dancing",
    },
  ];

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden px-6 py-8 sm:px-10 lg:px-16">
      <SilverVinesBackground />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col">
        <header className="flex flex-col gap-6 border-b border-accent/20 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-muted">Happily Ever After</p>
            {/* <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl text-foreground sm:text-5xl">
             
            </h1> */}
          </div>

          <SiteNav />
        </header>

        <section className="grid flex-1 gap-10 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:py-16">
          <div className="flex flex-col justify-center">
            <p className="text-sm uppercase tracking-[0.45em] text-accent">The Wedding of</p>
            <h2 className="mt-6 max-w-3xl font-[family-name:var(--font-display)] text-6xl leading-[0.95] text-foreground sm:text-7xl">
              Felicia Morgan &amp; Jacob Aulenback
            </h2>
            <p className="mt-8 max-w-xl text-lg leading-8 text-muted">
              The pleasure of your company is requested at the wedding of Felicia Morgan &amp; Jacob Aulenback on Saturday, January 9th, 2027 at the Esquimalt Gorge Pavilion in Victoria, BC. 
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

          <div className="relative min-h-[420px] overflow-hidden border border-accent/25 bg-card">
            <img
              src="/10_Jacob_Disney_Proposal_.jpg"
              alt="Engagement photo"
              className="h-full w-full object-cover"
            />
          </div>
        </section>

        <section id="details" className="grid gap-8 border-t border-accent/20 py-10 lg:grid-cols-[0.9fr_1.1fr] lg:py-12">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-accent">Basic Info</p>
            <h3 className="mt-4 font-[family-name:var(--font-display)] text-4xl text-foreground sm:text-5xl">
              When &amp; Where
            </h3>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {details.map((item) => (
              <div key={item.label} className="border-t border-accent/20 pt-4">
                <p className="text-xs uppercase tracking-[0.35em] text-muted">{item.label}</p>
                <p className="mt-3 text-lg leading-8 text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
