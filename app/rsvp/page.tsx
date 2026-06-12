import { SectionPageLayout } from "@/app/components/SectionPageLayout";

export default function RsvpPage() {
  return (
    <SectionPageLayout
      eyebrow="RSVP"
      title="Respond to the Invitation"
      body={
        <p className="max-w-xl text-lg leading-8 text-muted">
          Online RSVPs are not open yet. Please check back soon for the response form, attendance details, and meal information.
        </p>
      }
      aside={
        <div className="border border-accent/25 bg-card px-8 py-10 sm:px-10 sm:py-12">
          <p className="text-sm uppercase tracking-[0.45em] text-accent">Coming Soon</p>
          <p className="mt-6 font-[family-name:var(--font-display)] text-4xl text-foreground sm:text-5xl">
            RSVP details will be shared soon.
          </p>
          <p className="mt-6 max-w-lg text-base leading-8 text-muted">
            We will post the response form, attendance questions, and meal information here once everything is ready.
          </p>
        </div>
      }
    />
  );
}