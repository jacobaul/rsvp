import { requireAdmin } from "@/lib/auth/dal";
import { IMPORT_TEMPLATE } from "@/lib/rsvp/csv-import";

import { Card, PageHeading } from "../../components/ui";
import { ImportWizard } from "./ImportWizard";

export default async function ImportPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title="Import guest list"
        description="Bring in the invite list from a spreadsheet. Nothing is written until you confirm the preview."
      />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <ImportWizard template={IMPORT_TEMPLATE} />

        <Card className="h-fit">
          <h2 className="mb-3 text-sm uppercase tracking-[0.25em] text-muted">
            Template
          </h2>
          <pre className="overflow-x-auto border border-accent/20 bg-background p-3 text-xs leading-5 text-foreground">
            {IMPORT_TEMPLATE}
          </pre>
          <dl className="mt-4 flex flex-col gap-3 text-xs text-muted">
            <div>
              <dt className="font-semibold text-foreground">party</dt>
              <dd>
                Required. Rows sharing this value form one invitation with one
                code.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-foreground">first_name</dt>
              <dd>Required. One row per named guest.</dd>
            </div>
            <div>
              <dt className="font-semibold text-foreground">
                plus_ones_allowed
              </dt>
              <dd>
                How many extra guests the party may bring, 0 to 3. The old
                yes/no spelling still works and counts as 1. The largest value
                seen across a party&apos;s rows wins.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-foreground">tags</dt>
              <dd>Separated by semicolons or commas inside quotes.</dd>
            </div>
            <div>
              <dt className="font-semibold text-foreground">code</dt>
              <dd>
                Optional. Leave blank to generate. Supply it to keep a code that
                is already on a printed card.
              </dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
