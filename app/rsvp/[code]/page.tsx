import { notFound, redirect } from "next/navigation";
import { after } from "next/server";

import { SilverVinesBackground } from "@/app/components/SilverVinesBackground";
import { SiteNav } from "@/app/components/SiteNav";
import { RATE_LIMITS, rateLimit } from "@/lib/auth/rate-limit";
import { logEvent, logPartyView } from "@/lib/rsvp/activity";
import { formatCode, normalizeCode } from "@/lib/rsvp/codes";
import {
  getPartyByCode,
  guestDisplayName,
  namedGuests,
  plusOneGuests,
} from "@/lib/rsvp/queries";
import { getRequestContext, rateLimitKey } from "@/lib/rsvp/request-context";
import { deadlineHasPassed, getSettings, rsvpIsEditable } from "@/lib/rsvp/settings";
import { RSVP_STATUS_LABELS } from "@/lib/validation/rsvp";

import { RsvpForm, type FormGuest } from "./RsvpForm";

export const metadata = {
  title: "Your Invitation | Jacob and Felicia Wedding",
  robots: { index: false, follow: false },
};

function formatDeadline(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "long",
    timeZone: "America/Vancouver",
  }).format(date);
}

export default async function PartyPage({
  params,
}: PageProps<"/rsvp/[code]">) {
  const { code } = await params;
  const normalized = normalizeCode(code);
  const canonical = formatCode(normalized);

  // Read request data during render; `after` callbacks cannot call headers().
  const { ip, userAgent } = await getRequestContext();

  const party = await getPartyByCode(normalized);

  if (!party) {
    // Someone is on a code URL that does not exist: a typo, a stale card, or
    // someone walking the code space. Record it so the admin can tell which.
    // `after` still runs when notFound() throws.
    const limit = rateLimit(
      rateLimitKey("code-url", ip),
      RATE_LIMITS.codeLookup.limit,
      RATE_LIMITS.codeLookup.windowMs,
    );

    if (limit.allowed) {
      after(() => {
        void logEvent({
          type: "lookup_failed",
          ip,
          userAgent,
          path: `/rsvp/${canonical}`,
          metadata: { attempted: normalized, via: "url" },
        });
      });
    }

    notFound();
  }

  if (code !== canonical) {
    redirect(`/rsvp/${canonical}`);
  }

  const settings = await getSettings();

  after(() => {
    void logPartyView({
      partyId: party.id,
      ip,
      userAgent,
      path: `/rsvp/${canonical}`,
    });
  });

  const named = namedGuests(party);
  const plusOnes = plusOneGuests(party);
  const editable = rsvpIsEditable(settings);
  const closed = deadlineHasPassed(settings);
  const hasResponded = party.respondedAt !== null;

  const formGuests: FormGuest[] = named.map((guest) => ({
    id: guest.id,
    name: guestDisplayName(guest),
    rsvpStatus: guest.rsvpStatus,
    dietaryNotes: guest.dietaryNotes ?? "",
  }));

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden px-6 py-8 sm:px-10 lg:px-16">
      <SilverVinesBackground />

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col">
        <header className="flex flex-col gap-5 border-b border-accent/20 pb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div className="text-center sm:text-left">
            <p className="font-[family-name:var(--font-display)] text-2xl tracking-[0.08em] text-foreground/85 sm:text-sm sm:uppercase sm:tracking-[0.35em] sm:text-muted">
              Happily Ever After
            </p>
          </div>
          <SiteNav />
        </header>

        <section className="py-10">
          <p className="text-sm uppercase tracking-[0.45em] text-accent">RSVP</p>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-5xl leading-[1] text-foreground sm:text-6xl">
            {party.name}
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
            {named.length === 1
              ? "You are invited to celebrate with us on Saturday, January 9th, 2027 at Esquimalt Gorge Pavilion in Victoria, BC."
              : "Your party is invited to celebrate with us on Saturday, January 9th, 2027 at Esquimalt Gorge Pavilion in Victoria, BC."}
          </p>

          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-base text-foreground">
            {named.map((guest) => (
              <li key={guest.id} className="font-medium">
                {guestDisplayName(guest)}
              </li>
            ))}
          </ul>

          {settings.rsvpDeadline && !closed ? (
            <p className="mt-4 text-sm uppercase tracking-[0.2em] text-muted">
              Please reply by {formatDeadline(settings.rsvpDeadline)}
            </p>
          ) : null}

          <div className="mt-10">
            {!settings.rsvpOpen ? (
              <div className="border border-accent/40 bg-card px-6 py-8 sm:px-8">
                <p className="text-sm uppercase tracking-[0.45em] text-accent">
                  Not open yet
                </p>
                <p className="mt-4 font-[family-name:var(--font-display)] text-3xl text-foreground">
                  RSVPs open soon.
                </p>
                <p className="mt-4 text-base leading-8 text-muted">
                  Your code works. Come back to this same link when responses
                  open and your form will be here.
                </p>
              </div>
            ) : !editable ? (
              <div className="border border-accent/40 bg-card px-6 py-8 sm:px-8">
                <p className="text-sm uppercase tracking-[0.45em] text-accent">
                  Responses closed
                </p>
                <p className="mt-4 font-[family-name:var(--font-display)] text-3xl text-foreground">
                  {hasResponded ? "Here is your response." : "The deadline has passed."}
                </p>

                {hasResponded ? (
                  <dl className="mt-6 flex flex-col gap-3">
                    {party.guests.map((guest) => (
                      <div key={guest.id} className="flex flex-col">
                        <dt className="font-medium text-foreground">
                          {guestDisplayName(guest)}
                          {guest.kind === "plus_one" ? " (your guest)" : ""}
                        </dt>
                        <dd className="text-muted">
                          {RSVP_STATUS_LABELS[guest.rsvpStatus]}
                          {guest.dietaryNotes
                            ? ` · ${guest.dietaryNotes}`
                            : ""}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}

                <p className="mt-6 text-base leading-8 text-muted">
                  If anything needs to change, please get in touch with us
                  directly and we will take care of it.
                </p>
              </div>
            ) : (
              <RsvpForm
                code={canonical}
                email={party.email ?? ""}
                phone={party.phone ?? ""}
                guestMessage={party.guestMessage ?? ""}
                guests={formGuests}
                plusOnesAllowed={party.plusOnesAllowed}
                plusOnes={plusOnes.map((guest) => ({
                  id: guest.id,
                  name: guestDisplayName(guest),
                  rsvpStatus: guest.rsvpStatus,
                  dietaryNotes: guest.dietaryNotes ?? "",
                }))}
                ceremonyLabel={settings.ceremonyLabel}
                receptionLabel={settings.receptionLabel}
                ceremonyEnabled={settings.ceremonyEnabled}
                receptionEnabled={settings.receptionEnabled}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
