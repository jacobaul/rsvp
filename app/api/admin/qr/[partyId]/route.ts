import { guardAdminRoute } from "@/lib/rsvp/api-auth";
import { formatCode } from "@/lib/rsvp/codes";
import { getPartyById } from "@/lib/rsvp/queries";
import { renderQrPng, renderQrSvg, slugify } from "@/lib/rsvp/qr";
import { getSettings, partyUrl, resolveSiteUrl } from "@/lib/rsvp/settings";

export async function GET(
  request: Request,
  context: RouteContext<"/api/admin/qr/[partyId]">,
) {
  const denied = await guardAdminRoute();

  if (denied) {
    return denied;
  }

  const { partyId } = await context.params;
  const id = Number(partyId);

  if (!Number.isInteger(id) || id <= 0) {
    return new Response("Bad request", { status: 400 });
  }

  const format = new URL(request.url).searchParams.get("format") ?? "svg";

  if (format !== "svg" && format !== "png") {
    return new Response("format must be svg or png", { status: 400 });
  }

  const party = await getPartyById(id);

  if (!party) {
    return new Response("Not found", { status: 404 });
  }

  const settings = await getSettings();

  if (!resolveSiteUrl(settings)) {
    return new Response(
      "Set the site URL in admin settings before downloading QR codes.",
      { status: 409 },
    );
  }

  const formatted = formatCode(party.code);
  const url = partyUrl(settings, formatted);
  const filename = `${slugify(party.name)}__${formatted}.${format}`;

  const headers = {
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store",
  };

  if (format === "svg") {
    return new Response(await renderQrSvg(url), {
      headers: { ...headers, "Content-Type": "image/svg+xml; charset=utf-8" },
    });
  }

  const png = await renderQrPng(url);

  return new Response(new Uint8Array(png), {
    headers: { ...headers, "Content-Type": "image/png" },
  });
}
