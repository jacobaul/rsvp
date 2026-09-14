# Wedding site and RSVP system

Next.js 16 app for the wedding site, with a code-based RSVP flow for guests and
a password-protected admin area for managing the invite list, QR codes,
responses, and an activity log.

The design notes behind this live in [docs/rsvp-admin-plan.md](docs/rsvp-admin-plan.md).

## How the RSVP flow works

Each invited party gets one card carrying a QR code and an eight-character
access code, printed as `ABCD-EFGH`. The QR code links to `/rsvp/ABCD-EFGH`.
Guests who cannot scan can type the code at `/rsvp` instead. The code is the
only credential, so guests never create an account or a password.

On that page a party sees everyone on their invitation, answers for each guest
(ceremony, reception, both, or unable to attend), notes any allergies or
dietary restrictions, names any additional guests their invitation allows, and
leaves an email address. They can come back to the same link and change any of it until
the deadline.

Every visit to a party's link is recorded, including visits that end without a
submission, so the admin can tell the difference between "has not looked" and
"looked and did not reply".

## Getting started

Requires Node 22+ and pnpm 10.

```bash
pnpm install
docker compose -f docker-compose.dev.yaml up -d db   # local Postgres
cp .env.example .env                                  # then fill it in
pnpm admin:password 'a-long-admin-password'           # paste the output into .env
pnpm db:migrate
pnpm db:seed                                          # optional sample parties
pnpm dev
```

Open http://localhost:3000 for the site and http://localhost:3000/admin for the
admin area. The seed script prints the access codes it generated so you can try
the guest flow immediately.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. |
| `DATABASE_SSL` | `require` (default), `verify-full`, `prefer`, or `disable`. Use `disable` only for the local container. |
| `SESSION_SECRET` | Signs the admin session cookie. Generate with `openssl rand -base64 32`. |
| `ADMIN_PASSWORD_HASH` | Output of `pnpm admin:password`, pasted unquoted. The plaintext password is never stored. |
| `NEXT_PUBLIC_SITE_URL` | Fallback base URL for QR codes when the admin Settings page has none. |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Travel page map. |
| `TUNNEL_TOKEN` | Cloudflare tunnel, production only. |

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Development server. |
| `pnpm build` | Production build. Succeeds with no database reachable. |
| `pnpm test` | Unit and integration tests. |
| `pnpm typecheck` | TypeScript, no emit. |
| `pnpm lint` | ESLint. |
| `pnpm db:generate` | Generate a migration after changing the schema. |
| `pnpm db:migrate` | Apply migrations manually. The server also does this at startup. |
| `pnpm db:studio` | Drizzle Studio, a browser UI over the data. |
| `pnpm db:seed` | Reset to sample parties. Development only, it deletes existing parties. |
| `pnpm admin:password` | Hash an admin password for `.env`. |

## Admin area

Sign in at `/admin/login` with the password whose hash is in
`ADMIN_PASSWORD_HASH`. There is one shared password, not per-person accounts.
If the sign-in page reports that the hash is not valid, regenerate it with
`pnpm admin:password` and paste the new value in unquoted.

- **Dashboard** shows party and guest counts, every allergy and dietary
  restriction reported by an attending guest, a response curve, and a "needs
  attention" list covering parties that opened their invite repeatedly without
  replying.
- **Parties** lists everyone with search, status and tag filters, and sorting.
  Select rows to generate QR codes or regenerate codes in bulk.
- **Party detail** edits the party and its guests, shows the QR code and link,
  lets you fill in an RSVP on a guest's behalf, and shows that party's full
  history with a before-and-after view of every change.
- **Import** brings in a guest list from CSV in two steps, showing exactly what
  will be created, updated, or skipped before anything is written.
- **QR codes** previews every code, downloads a ZIP of SVG and PNG files with a
  manifest, exports a mail-merge CSV, and offers a printable sheet.
- **Responses** is a guest-level table with filters, including one for guests
  who reported a restriction, and a CSV export shaped for a caterer or seating
  chart.
- **Activity** is the full log, filterable by event type, date range, and IP.
- **Settings** controls whether RSVPs are open, the deadline, the site URL used
  in QR codes, and the event names.

### Importing a guest list

One row per guest. Rows sharing a `party` value become a single invitation with
a single code.

```csv
party,first_name,last_name,plus_ones_allowed,email,phone,tags,notes,code
The Aulenback Family,Robert,Aulenback,0,robert@example.com,,groom-family,,
The Aulenback Family,Susan,Aulenback,0,,,groom-family,,
Sam Rivera,Sam,Rivera,2,,,work,Met at the conference,
```

Only `party` and `first_name` are required. `plus_ones_allowed` is how many
extra guests the party may bring, 0 to 3; the older `plus_one_allowed` header
with yes/no still works and counts as 1. Leave `code` blank to generate one;
fill it in to preserve a code that is already on a printed card. When a party
name already exists you choose whether to skip it, update its details and add
missing guests, or replace its guest list entirely.

### Printing cards

1. Set the site URL in Settings first. QR codes encode a full URL, and changing
   it later breaks every card already printed.
2. Import or add the parties.
3. Download the ZIP from the QR codes page. Files are named
   `party-slug__CODE.svg` so a designer can match art to party, and the included
   `manifest.csv` maps party to code to URL for a mail merge.

## Deployment

Production runs the standalone build as a container behind a Cloudflare tunnel,
against an existing Postgres server. See [docker-compose.yaml](docker-compose.yaml).

The database and role must already exist, and the role needs `CREATE` on its
schema. The app applies its own migrations at startup from
[instrumentation.ts](instrumentation.ts), retrying briefly if the database is
not yet accepting connections, so no separate migration step is needed in the
deploy.

`stop_grace_period` is set to 20 seconds so in-flight requests and deferred
activity-log writes finish before the container exits.

### Backups

The wider server's backup regime covers the data. To take a snapshot before a
risky import or a bulk code regeneration:

```bash
pg_dump "$DATABASE_URL" -Fc -f rsvp-$(date +%F).dump
pg_restore -d "$DATABASE_URL" --clean rsvp-2027-01-09.dump
```

## Notes for future work

- **There is no meal choice.** Guests give a single free-text allergies and
  dietary restrictions note instead, which the dashboard and the responses
  export collect for the caterer. Notes are cleared for anyone who declines,
  since there is nothing to cater for.
- **Additional guests are capped per party.** The allowance lives on the party
  row as a count, bounded by a database check constraint and by `MAX_PLUS_ONES`
  in the schema. Raising the cap means changing both. Guests name their own
  extras, so the server clamps every submission to the party's allowance rather
  than trusting the form.
- **Access codes are credentials.** Anyone with a code can see and change that
  party's response. Codes are eight characters from a 32-symbol alphabet with no
  ambiguous glyphs, giving 40 bits of entropy, and lookups are rate limited per
  IP. Failed lookups are logged so code guessing is visible in the activity log.
- **Cache Components is not enabled**, so any page reading the database must
  stay dynamic or Next will try to render it at build time, when the Docker
  builder has no database. Admin pages get this from reading cookies, plus a
  `force-dynamic` export on the admin layout. The database client connects
  lazily for the same reason.
- **A `"use server"` file may only export async functions.** Form state types
  and their initial values live in separate `*-state.ts` modules.
- **Never put a `$` in a value in `.env`.** Next.js loads env files through
  dotenv-expand, which replaces `$name` with an empty string. That silently
  corrupted the admin password hash, which is why it uses `.` as its field
  separator. If you add a secret containing `$`, escape it as `\$`.
- Integration tests create a throwaway database per test file from the real
  migrations, and skip themselves when no Postgres is reachable.
