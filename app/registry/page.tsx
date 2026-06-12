import { SectionPageLayout } from "@/app/components/SectionPageLayout";

export default function RegistryPage() {
  return (
    <SectionPageLayout
      eyebrow="Registry"
      title="Gift Information"
      body={
        <div className="grid gap-6 max-w-xl text-lg leading-8 text-muted">
          <p>
            We&apos;re still finalizing details for the celebration.
            If we share a registry or preferred gift options, this page will be updated with the links and any helpful guidance.
          </p>
        </div>
      }
      aside={
        <div className="border border-accent/25 bg-card px-8 py-10 sm:px-10 sm:py-12">
          <p className="text-sm uppercase tracking-[0.45em] text-accent">For Now</p>
          <p className="mt-6 font-[family-name:var(--font-display)] text-4xl text-foreground sm:text-5xl">
            No registry links yet.
          </p>
          <p className="mt-6 max-w-lg text-base leading-8 text-muted">
            When details are ready, this panel will hold the direct links
          </p>
        </div>
      }
    />
  );
}