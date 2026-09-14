import { requireAdmin } from "@/lib/auth/dal";
import { formatCode } from "@/lib/rsvp/codes";
import { guestDisplayName, listParties, namedGuests } from "@/lib/rsvp/queries";
import { getSettings, partyUrl, resolveSiteUrl } from "@/lib/rsvp/settings";

import { QrPreview } from "../../../components/QrPreview";

export const metadata = {
  title: "QR print sheet",
  robots: { index: false, follow: false },
};

export default async function QrPrintPage({
  searchParams,
}: PageProps<"/admin/qr/print">) {
  await requireAdmin();

  const [settings, params] = await Promise.all([getSettings(), searchParams]);

  if (!resolveSiteUrl(settings)) {
    return (
      <p className="p-8 text-sm">
        Set the site URL in admin settings before printing.
      </p>
    );
  }

  const idsParam = Array.isArray(params.ids) ? params.ids[0] : params.ids;
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

  return (
    <div className="bg-white p-6 text-black print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <p className="text-sm text-gray-700">
          {parties.length} card{parties.length === 1 ? "" : "s"}. Use your
          browser&apos;s print dialog.
        </p>
        <a
          href="/admin/qr"
          className="border border-gray-400 px-4 py-2 text-sm uppercase tracking-[0.15em]"
        >
          Back
        </a>
      </div>

      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
        {parties.map((party) => {
          const formatted = formatCode(party.code);

          return (
            <div
              key={party.id}
              className="flex break-inside-avoid flex-col items-center border border-gray-300 p-4 text-center"
            >
              <p className="text-sm font-semibold">{party.name}</p>
              <p className="mt-1 text-xs text-gray-600">
                {namedGuests(party).map(guestDisplayName).join(", ")}
              </p>
              <div className="mt-3">
                <QrPreview url={partyUrl(settings, formatted)} size={140} />
              </div>
              <p className="mt-2 font-mono text-sm tracking-[0.2em]">
                {formatted}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
