import Image from "next/image";

import { SectionPageLayout } from "@/app/components/SectionPageLayout";
import { TravelMap } from "@/app/components/TravelMap";

export default function SchedulePage() {
  const events = [
    {
      time: "Afternoon (2:00 PM)",
      title: "Guests Arrive",
      description: "Guests are asked to arrive at the venue at 2:00 PM to allow time for parking and settling in before the ceremony begins.",
    },
    {
      time: "Afternoon",
      title: "Ceremony",
      description: "The ceremony will take place at the pavilion, followed by time to mingle and enjoy the grounds.",
    },
    {
      time: "Early Evening (6:00 PM)",
      title: "Reception and Dinner",
      description: "Dinner service begins at 6:00 PM, followed by speeches and a few shared moments with family and friends.",
    },
    {
      time: "Evening (until 11:00 PM)",
      title: "Celebration",
      description: "Celebrations will continue into the evening with music, dancing, and good company. The evening will wind down at 11:00 PM to allow for cleanup."
    },
  ];

  return (
    <SectionPageLayout
      eyebrow="Schedule &amp; Travel"
      title="The Day Of"
      asideFirstOnMobile
      body={
        <div className="grid max-w-xl gap-8">
          <div>
            <p className="text-sm uppercase tracking-[0.45em] text-accent">The Venue</p>
            <h2 className="mt-4 font-[family-name:var(--font-display)] text-4xl leading-tight text-foreground sm:text-5xl">
              Esquimalt Gorge Park &amp; Pavilion
            </h2>
          </div>

          <div className="relative aspect-[4/3] overflow-hidden border border-accent/25 bg-card">
            <Image
              src="/esquimalt_gorge_pavilion.jpg"
              alt="Esquimalt Gorge Park &amp; Pavilion"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>

          <p className="text-lg leading-8 text-muted">
            The wedding ceremony and reception will both take place at the Esquimalt Gorge Pavilion in Victoria, BC. The Pavilion, located in Esquimalt Gorge Park (1070 Tillicum Road), features Japanese-inspired architecture complementing the surrounding Japanese gardens.
          </p>
          <p className="text-lg leading-8 text-muted">
            The Pavilion can be accessed on foot via park pathways, by vehicle, or by bike.
            86 parking spots, 10 accessible parking spots,
            4 EV charging stations and a bike rack are available.
          </p>

          <div className="overflow-hidden border border-accent/25 bg-card">
            <TravelMap />
          </div>
        </div>
      }
      aside={
        <div className="border border-accent/25 bg-card px-8 py-10 sm:px-10 sm:py-12">
          <p className="text-sm uppercase tracking-[0.45em] text-accent">Key Events</p>
          <p className="mt-6 font-[family-name:var(--font-display)] text-4xl text-foreground sm:text-5xl">
            The day-of timeline.
          </p>
          <div className="mt-10 grid gap-8">
            {events.map((event, index) => (
              <div key={event.title} className="relative pl-10">
                {index < events.length - 1 ? (
                  <div className="absolute top-6 bottom-[-2.25rem] left-[0.6875rem] w-px bg-accent/25" aria-hidden="true" />
                ) : null}
                <div className="absolute left-0 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-accent/40 bg-background">
                  <div className="h-2.5 w-2.5 rounded-full bg-accent" />
                </div>
                <p className="text-xs uppercase tracking-[0.35em] text-accent/80">{event.time}</p>
                <p className="mt-2 text-2xl font-[family-name:var(--font-display)] text-foreground">{event.title}</p>
                <p className="mt-3 max-w-lg text-base leading-8 text-muted">{event.description}</p>
              </div>
            ))}
          </div>
        </div>
      }
    />
  );
}
