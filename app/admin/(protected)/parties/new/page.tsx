import { requireAdmin } from "@/lib/auth/dal";

import { PageHeading } from "../../../components/ui";
import { PartyForm } from "../PartyForm";

export default async function NewPartyPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title="Add party"
        description="A code is generated automatically once the party is created."
      />

      <PartyForm
        values={{
          name: "",
          email: "",
          phone: "",
          plusOnesAllowed: 0,
          tags: [],
          adminNotes: "",
          guestMessage: "",
          guests: [],
        }}
      />
    </div>
  );
}
