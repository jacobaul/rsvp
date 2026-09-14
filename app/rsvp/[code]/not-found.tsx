import Link from "next/link";

import { SectionPageLayout } from "@/app/components/SectionPageLayout";

export default function PartyNotFound() {
  return (
    <SectionPageLayout
      eyebrow="RSVP"
      title="We couldn't find that code"
      titleClassName="text-5xl sm:text-6xl"
      body={
        <div className="max-w-xl text-lg leading-8 text-muted">
          <p>
            Double check the eight characters printed on your card. The letter O
            and the number zero are easy to mix up, and so are the letter L and
            the number one, though we accept either.
          </p>
          <Link
            href="/rsvp"
            className="mt-8 inline-block border border-accent bg-accent px-6 py-3 text-sm font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-accent-strong"
          >
            Try another code
          </Link>
        </div>
      }
      aside={
        <div className="border border-accent/25 bg-card px-8 py-10 sm:px-10 sm:py-12">
          <p className="text-sm uppercase tracking-[0.45em] text-accent">
            Still stuck?
          </p>
          <p className="mt-6 max-w-lg text-base leading-8 text-muted">
            Send us a message and we will look up your invitation and send the
            link straight to you.
          </p>
        </div>
      }
    />
  );
}
