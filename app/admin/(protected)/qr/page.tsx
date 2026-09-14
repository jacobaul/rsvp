import Link from "next/link";

import { requireAdmin } from "@/lib/auth/dal";
import { formatCode } from "@/lib/rsvp/codes";
import { listParties } from "@/lib/rsvp/queries";
import { getSettings, partyUrl, resolveSiteUrl } from "@/lib/rsvp/settings";

import { QrPreview } from "../../components/QrPreview";
import {
  Card,
  EmptyState,
  PageHeading,
  buttonClass,
  secondaryButtonClass,
} from "../../components/ui";

export default async function QrPage({ searchParams }: PageProps<"/admin/qr">) {
  await requireAdmin();

  const [settings, params] = await Promise.all([getSettings(), searchParams]);
  const base = resolveSiteUrl(settings);

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
  const query = wanted ? `?ids=${Array.from(wanted).join(",")}` : "";

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title="QR codes"
        description={
          wanted
            ? `${parties.length} selected ${
                parties.length === 1 ? "party" : "parties"
              }.`
            : "One QR code per party, pointing at that party's RSVP page."
        }
        actions={
          base ? (
            <>
              <a href={`/api/admin/qr/all${query}`} className={buttonClass}>
                Download ZIP
              </a>
              <a
                href="/api/admin/export/parties"
                className={secondaryButtonClass}
              >
                Mail-merge CSV
              </a>
              <Link
                href={`/admin/qr/print${query}`}
                className={secondaryButtonClass}
              >
                Print sheet
              </Link>
            </>
          ) : null
        }
      />

      {!base ? (
        <div className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Set the site URL first.</p>
          <p className="mt-1">
            QR codes encode a full URL. Without one they will point nowhere and
            the printed cards will be useless. Add it in{" "}
            <Link
              href="/admin/settings"
              className="underline underline-offset-4"
            >
              Settings
            </Link>
            .
          </p>
        </div>
      ) : !base.startsWith("https://") ? (
        <div className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          The site URL is <code>{base}</code>, which is not https. Cards printed
          with this will not work for guests on the public internet.
        </div>
      ) : null}

      {wanted ? (
        <p className="text-sm">
          <Link
            href="/admin/qr"
            className="text-accent-strong underline underline-offset-4"
          >
            Show all parties instead
          </Link>
        </p>
      ) : null}

      {parties.length === 0 ? (
        <EmptyState>
          No parties yet.{" "}
          <Link
            href="/admin/import"
            className="text-accent-strong underline underline-offset-4"
          >
            Import a list
          </Link>{" "}
          to get started.
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {parties.map((party) => {
            const formatted = formatCode(party.code);

            return (
              <Card key={party.id} className="flex flex-col items-center text-center">
                <Link
                  href={`/admin/parties/${party.id}`}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {party.name}
                </Link>

                {base ? (
                  <div className="mt-3">
                    <QrPreview url={partyUrl(settings, formatted)} size={150} />
                  </div>
                ) : null}

                <p className="mt-3 font-mono text-sm tracking-[0.15em] text-muted">
                  {formatted}
                </p>

                {base ? (
                  <div className="mt-3 flex gap-2 text-xs">
                    <a
                      href={`/api/admin/qr/${party.id}?format=svg`}
                      className="text-accent-strong underline underline-offset-4"
                    >
                      SVG
                    </a>
                    <a
                      href={`/api/admin/qr/${party.id}?format=png`}
                      className="text-accent-strong underline underline-offset-4"
                    >
                      PNG
                    </a>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
