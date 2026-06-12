import Image from "next/image";

import { SectionPageLayout } from "@/app/components/SectionPageLayout";

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
      time: "Early Evening",
      title: "Reception and Dinner",
      description: "Dinner service, speeches, and a few shared moments with family and friends will follow the ceremony.",
    },
    {
      time: "Evening",
      title: "Celebration",
      description: "Celebrations will continue into the evening with music, dancing, and good company. The evening will wind down at a reasonable hour to allow for cleanup."
    },
  ];

  return (
    <SectionPageLayout
      eyebrow="Schedule"
      title="The Day Of"
      body={
        <div className="grid max-w-xl gap-8">
          <p className="text-lg leading-8 text-muted">
            We&apos;re still finalizing exact times and activities. Check back here for the most up-to-date schedule as we get closer to the day.
          </p>
          <div className="relative aspect-square overflow-hidden border border-accent/25 bg-card">
            <Image
              src="/epcot.jpg"
              alt="Jacob and Felicia at Epcot (in front of the EPCOT ball)"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
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