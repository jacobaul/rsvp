import { PlaceholderSectionPage } from "@/app/components/PlaceholderSectionPage";

export default function SchedulePage() {
  const details = [
    {
      label: "Date",
      value: "Saturday, January 9th, 2027",
    },
    {
      label: "Venue",
      value: "Esquimalt Gorge Pavilion",
    },
    {
      label: "Location",
      value: "Victoria, BC",
    },
  ];

  return (
    <PlaceholderSectionPage
      eyebrow="Schedule"
      title="Weekend Timeline"
      description="Our wedding weekend schedule is still being finalized. Ceremony timing, dinner details, and other events will be posted here soon."
      details={details}
    />
  );
}