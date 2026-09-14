import { guardAdminRoute } from "@/lib/rsvp/api-auth";
import { formatCode } from "@/lib/rsvp/codes";
import { listParties } from "@/lib/rsvp/queries";
import { buildQrZip } from "@/lib/rsvp/qr";
import { getSettings, partyUrl, resolveSiteUrl } from "@/lib/rsvp/settings";

export async function GET(request: Request) {
  const denied = await guardAdminRoute();

  if (denied) {
    return denied;
  }

  const settings = await getSettings();

  if (!resolveSiteUrl(settings)) {
    return new Response(
      "Set the site URL in admin settings before downloading QR codes.",
      { status: 409 },
    );
  }

  const idsParam = new URL(request.url).searchParams.get("ids");
  const wanted = idsParam
    ? new Set(
        idsParam
          .split(",")
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0),
      )
    : null;

  const all = await listParties({ sort: "name" });
  const parties = wanted ? all.filter((party) => wanted.has(party.id)) : all;

  if (parties.length === 0) {
    return new Response("No parties to export", { status: 404 });
  }

  const zip = await buildQrZip(
    parties.map((party) => {
      const formatted = formatCode(party.code);

      return {
        partyName: party.name,
        formattedCode: formatted,
        url: partyUrl(settings, formatted),
      };
    }),
  );

  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(zip as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="rsvp-qr-codes-${stamp}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
