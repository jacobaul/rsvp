import Image from "next/image";

import { SectionPageLayout } from "@/app/components/SectionPageLayout";
import { TravelMap } from "@/app/components/TravelMap";

export default function TravelPage() {
  return (
    <SectionPageLayout
      eyebrow="Travel"
      title="Esquimalt Gorge Park &amp; Pavilion"
      titleClassName="text-5xl sm:text-7xl"
      body={
        <div className="grid gap-8">
          <div className="relative aspect-[4/3] overflow-hidden border border-accent/25 bg-card">
            <Image
              src="/esquimalt_gorge_pavilion.jpg"
              alt="Esquimalt Gorge Park &amp; Pavilion"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <p className="max-w-xl text-lg leading-8 text-muted">
            The wedding ceremony and reception will both take place at the Esquimalt Gorge Pavilion in Victoria, BC. The Pavilion, located in Esquimalt Gorge Park (1070 Tillicum Road), features Japanese-inspired architecture complementing the surrounding Japanese gardens.
          </p>
          <p className="max-w-xl text-lg leading-8 text-muted">
            The Pavilion can be accessed on foot via park pathways, by vehicle, or by bike.
            86 parking spots, 10 accessible parking spots,
            4 EV charging stations and a bike rack are available.
          </p>
        </div>
      }
      aside={
        <div>
          <div className="overflow-hidden border border-accent/25 bg-card">
            <TravelMap />
          </div>
        </div>
      }
    />
  );
}