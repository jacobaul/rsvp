import { guardAdminRoute } from "@/lib/rsvp/api-auth";
import { formatCode } from "@/lib/rsvp/codes";
import { csvResponse, toCsv } from "@/lib/rsvp/csv";
import {
  guestDisplayName,
  listParties,
  namedGuests,
  partyStatus,
  PARTY_STATUS_LABELS,
} from "@/lib/rsvp/queries";
import { getSettings, partyUrl } from "@/lib/rsvp/settings";

/** Mail-merge shaped: one row per party, ready for a card design tool. */
export async function GET() {
  const denied = await guardAdminRoute();

  if (denied) {
    return denied;
  }

  const [settings, parties] = await Promise.all([
    getSettings(),
    listParties({ sort: "name" }),
  ]);

  const rows = parties.map((party) => {
    const formatted = formatCode(party.code);

    return [
      party.name,
      formatted,
      partyUrl(settings, formatted),
      namedGuests(party).map(guestDisplayName).join("; "),
      party.plusOnesAllowed,
      party.email ?? "",
      party.tags.join("; "),
      PARTY_STATUS_LABELS[partyStatus(party)],
      party.viewCount,
      party.lastViewedAt?.toISOString() ?? "",
      party.lastResponseAt?.toISOString() ?? "",
    ];
  });

  const csv = toCsv(
    [
      "party",
      "code",
      "url",
      "guest_names",
      "plus_ones_allowed",
      "email",
      "tags",
      "status",
      "view_count",
      "last_viewed_at",
      "last_response_at",
    ],
    rows,
  );

  const stamp = new Date().toISOString().slice(0, 10);

  return csvResponse(csv, `rsvp-parties-${stamp}.csv`);
}
