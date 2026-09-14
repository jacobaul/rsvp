import { guardAdminRoute } from "@/lib/rsvp/api-auth";
import { formatCode } from "@/lib/rsvp/codes";
import { csvResponse, toCsv } from "@/lib/rsvp/csv";
import { listParties } from "@/lib/rsvp/queries";
import { RSVP_STATUS_LABELS } from "@/lib/validation/rsvp";

/** One row per guest: the shape the caterer and seating chart want. */
export async function GET() {
  const denied = await guardAdminRoute();

  if (denied) {
    return denied;
  }

  const parties = await listParties({ sort: "name" });

  const rows = parties.flatMap((party) =>
    party.guests.map((guest) => [
      party.name,
      formatCode(party.code),
      guest.firstName,
      guest.lastName,
      guest.kind === "plus_one" ? "additional" : "named",
      RSVP_STATUS_LABELS[guest.rsvpStatus],
      guest.rsvpStatus === "both" || guest.rsvpStatus === "ceremony"
        ? "yes"
        : "no",
      guest.rsvpStatus === "both" || guest.rsvpStatus === "reception"
        ? "yes"
        : "no",
      guest.dietaryNotes ?? "",
      party.email ?? "",
      party.phone ?? "",
      party.lastResponseAt?.toISOString() ?? "",
    ]),
  );

  const csv = toCsv(
    [
      "party",
      "code",
      "first_name",
      "last_name",
      "guest_type",
      "response",
      "attending_ceremony",
      "attending_reception",
      "allergies_restrictions",
      "email",
      "phone",
      "last_response_at",
    ],
    rows,
  );

  const stamp = new Date().toISOString().slice(0, 10);

  return csvResponse(csv, `rsvp-responses-${stamp}.csv`);
}
