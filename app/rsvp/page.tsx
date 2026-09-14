import { SectionPageLayout } from "@/app/components/SectionPageLayout";

import { CodeEntryForm } from "./CodeEntryForm";

export const metadata = {
  title: "RSVP | Jacob and Felicia Wedding",
};

export default function RsvpPage() {
  return (
    <SectionPageLayout
      eyebrow="RSVP"
      title="Respond to the Invitation"
      body={
        <div className="max-w-xl text-lg leading-8 text-muted">
          <p>
            Scan the QR code on your invitation, or enter the code printed on the
            card below. Your code opens the response form for everyone in your
            party.
          </p>
          <CodeEntryForm />
        </div>
      }
      aside={
        <div className="border border-accent/25 bg-card px-8 py-10 sm:px-10 sm:py-12">
          <p className="text-sm uppercase tracking-[0.45em] text-accent">
            Need a hand?
          </p>
          <p className="mt-6 font-[family-name:var(--font-display)] text-4xl text-foreground sm:text-5xl">
            Can&apos;t find your code?
          </p>
          <p className="mt-6 max-w-lg text-base leading-8 text-muted">
            The code is the eight characters printed on your card, shown as
            four, a dash, then four. Letters are not case sensitive. If the card
            has gone astray, send us a message and we will look it up for you.
          </p>
        </div>
      }
    />
  );
}
