import { SectionPageLayout } from "@/app/components/SectionPageLayout";

export default function GiftsPage() {
  return (
    <SectionPageLayout
      eyebrow=""
      title="Gifts"
      titleClassName="text-5xl sm:text-6xl"
      body={
        <div className="mx-auto grid max-w-xl gap-6 text-lg leading-8 text-muted">
          <p>
            Having you with us on the day is the only thing we are asking for.
            Gifts are not required or expected.Please do not feel any obligation.
          </p>
          <p>
            If you would still like to give something, we are saving towards
            our first home together.
          </p>
           <p>
            Anything gifted will go straight towards setting up our new home.
            Cash is the simplest way to contribute, and it is very gratefully
            received either way.
          </p>
        </div>
      }

    />
  );
}
