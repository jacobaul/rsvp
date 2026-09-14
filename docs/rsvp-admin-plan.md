# RSVP System Plan: Code-Based Guest RSVP + Admin Management

Status: implemented. This document is the design record; see the README for
how to run and operate the result.
Scope: replaces the "coming soon" RSVP page with a working code-based RSVP flow, and adds a
password-protected `/admin` area for managing the invite list, QR codes, responses, stats, and
an activity log.

---

## 1. Goals and constraints

**Guest side**
- Each invitee group ("party") gets one physical card with a QR code. The QR code encodes a URL
  containing that party's access code.
- Opening the link (or typing the code on `/rsvp`) shows the party page: the names in the party,
  how many additional guests are allowed, and per-guest questions (ceremony /
  reception attendance, allergies and dietary restrictions), plus a party-level
  email address.
- Guests can submit, come back later, and edit until the RSVP deadline.
- Every visit to a party's link is recorded, whether or not anything is submitted.

**Admin side**
- Upload and manage the invite list (CSV import plus manual add/edit).
- Generate QR codes (per party and in bulk) and a code/URL export for card printing.
- View responses, per-party detail, and aggregate stats (headcounts, allergies, response rate).
- View the activity log globally and per party.

**Constraints from the current project**
- Next.js 16.2.7 App Router, React 19, Tailwind v4, TypeScript strict, pnpm.
- Deployed as a single `output: "standalone"` Docker container behind a Cloudflare tunnel
  (see [Dockerfile](../Dockerfile) and [docker-compose.yaml](../docker-compose.yaml)). Production
  will use an existing Postgres server reached over the network; the app only needs the connection
  details in its environment. A local compose Postgres exists for development only.
- Cache Components is **not** enabled, so the "previous" caching model applies: a page is
  prerendered at build time unless it touches a request-time API (`cookies()`, `headers()`,
  `connection()`) or is marked dynamic. This matters because the database will not exist during
  the Docker `pnpm build` step. Every page that reads the database must be dynamic.
- Next 16 specifics to respect: `proxy.ts` (not `middleware.ts`), async `params` / `cookies()` /
  `headers()`, `after()` for post-response logging, `revalidateTag` needs a second argument,
  `next lint` is gone (plain `eslint`).

---

## 2. Architecture decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Database | PostgreSQL (existing server in prod, a `db` compose service in dev) | Stated requirement. Gives real enums, `jsonb`, `timestamptz`, and transactional imports. Target Postgres 14+ features only so the existing server's version is unlikely to matter. |
| DB client | `postgres` (postgres.js) + Drizzle ORM | Pure JS driver, so nothing to compile in the `node:22-alpine` image. Drizzle gives typed queries and a migrations workflow. `pg` is the drop-in alternative if a library needs the node-postgres API. |
| Migrations | `drizzle-kit generate` checked into `drizzle/`, applied at server start from `instrumentation.ts` using `drizzle-orm/postgres-js/migrator` | Standalone image has no shell step to run migrations; `register()` runs once before the server accepts requests. Drizzle's migrator takes an advisory lock, so a restart racing a previous instance is safe. |
| Admin auth | Single shared admin password (hashed with Node's built-in `scrypt`), stateless session cookie signed with `jose` (HS256 JWT), 7-day expiry | Two admins (the couple), no need for user accounts. Mirrors the pattern in the Next.js auth guide. |
| Route protection | Optimistic redirect in `proxy.ts` + real check via `requireAdmin()` in every admin page, server action, and route handler | Proxy alone is not a security boundary; server actions are callable by direct POST. |
| Guest auth | The access code in the URL is the credential (bearer token). No cookie required. | Simplest thing that matches the physical-card flow. Codes get enough entropy plus rate limiting to resist guessing. |
| Access code format | 8 characters from a 32-symbol alphabet with no ambiguous glyphs (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`), displayed as `XXXX-XXXX`, stored normalized (uppercase, no dash) | 40 bits of entropy. Human-typeable as a fallback when the QR won't scan. |
| Mutations | Server actions with `useActionState` for guest and admin forms; route handlers only for file downloads (CSV, SVG/PNG, ZIP) | Idiomatic for this Next version, progressive enhancement for free. |
| Validation | `zod` | Shared schemas for form data and CSV rows. |
| QR generation | `qrcode` (pure JS, server side, SVG and PNG) | No native deps. |
| ZIP bundling | `fflate` | Small, pure JS, works in Node. |
| CSV | `csv-parse` / `csv-stringify` | Handles quoting and BOMs correctly, which hand-rolled parsers get wrong. |
| Tests | `vitest` for pure logic (code generation, CSV mapping, stats) | Cheap to add, protects the parts that are easy to break silently. |

Non-goals for this iteration: multi-user admin accounts, email sending, enabling
`cacheComponents`, and connection pooling beyond the driver's built-in pool (one app instance
talking to one Postgres is well within the default pool of 10).

---

## 3. Data model

All tables in Postgres via Drizzle (`drizzle-orm/pg-core`). Timestamps are `timestamptz`, ids are
`integer generated always as identity`, JSON columns are `jsonb`, and the two enums below are
native Postgres enums so bad values are rejected at the database.

### `settings` (single row, id = 1)
| column | type | notes |
| --- | --- | --- |
| rsvp_open | boolean | Master switch. When false, the party page shows a "not open yet" message and rejects submissions. |
| rsvp_deadline | timestamptz nullable | After this instant guests see their response read-only with a "contact us" note. Admin can still edit. |
| site_url | text | Base URL baked into QR codes, e.g. `https://wedding.example.com`. |
| ceremony_label / reception_label | text | Display names for the two events. |
| ceremony_enabled / reception_enabled | boolean | In case one event is invite-only later. |

### `parties`
| column | type | notes |
| --- | --- | --- |
| id | identity PK | |
| code | text unique | Normalized 8-char code. |
| name | text | Display name on the card and in admin, e.g. "The Aulenback Family". |
| email | text nullable | Filled by guest; admin may prefill from import. |
| phone | text nullable | Optional. |
| plus_ones_allowed | integer | How many extra guests the party may bring, 0 to 3, enforced by a check constraint. Superseded the original `plus_one_allowed` boolean in migration 0001. |
| tags | text[] | Free-text tags from import ("bride-family", "work"). GIN index for filtering. |
| admin_notes | text nullable | Never shown to guests. |
| guest_message | text nullable | Free-text note from the guest to the couple. |
| responded_at | timestamptz nullable | First submission. |
| last_response_at | timestamptz nullable | Most recent submission or edit. |
| first_viewed_at / last_viewed_at | timestamptz nullable | Denormalized from activity for fast list filtering. |
| view_count | integer default 0 | Denormalized. |
| created_at / updated_at | timestamptz default now() | |

### `guests`
| column | type | notes |
| --- | --- | --- |
| id | identity PK | |
| party_id | FK → parties, cascade delete | |
| kind | enum `guest_kind` (`named`, `plus_one`) | An extra guest becomes a guest row once the party names them. A party may have up to `plus_ones_allowed` of them, so there is no uniqueness constraint; the allowance is enforced in the save path. |
| first_name / last_name | text | Plus-one names are entered by the guest. |
| sort_order | integer | Display order. |
| rsvp_status | enum `rsvp_status` (`pending`, `both`, `ceremony`, `reception`, `declined`) | Single enum keeps stats queries simple. |
| dietary_notes | text nullable | Allergies and dietary restrictions, free text. Replaced the meal-preference column in migration 0003, which folded any existing choice into this field before dropping it. |
| updated_at | timestamptz default now() | |

### `activity_events`
| column | type | notes |
| --- | --- | --- |
| id | bigint identity PK | |
| party_id | FK nullable, cascade delete | Null for failed code lookups. |
| type | text | `view`, `submit`, `update`, `lookup_failed`, `admin_edit`, `admin_create`, `code_regenerated`, `import`. Kept as text rather than an enum so adding a type never needs a migration. |
| occurred_at | timestamptz default now() | |
| ip | inet nullable | From `cf-connecting-ip` (Cloudflare) falling back to `x-forwarded-for`. |
| user_agent | text nullable | |
| path | text nullable | |
| metadata | jsonb nullable | For `submit`/`update`: a field-level diff. For `lookup_failed`: the attempted code. For admin events: who/what changed. |

Indexes: `parties.code` (unique), `parties.tags` (GIN), `guests.party_id`, the partial unique
plus-one index, `activity_events(party_id, occurred_at desc)`, `activity_events(occurred_at desc)`.
The `view` insert and the `parties` counter bump happen in one transaction.

Derived party status for lists and stats (computed in a query helper, not stored):
- `declined`: every guest is `declined`
- `responded`: at least one guest is not `pending`
- `viewed`: `view_count > 0` and not responded
- `not_viewed`: otherwise

---

## 4. Guest flow

### Routes
```
app/rsvp/page.tsx              Code entry form (replaces the "coming soon" panel)
app/rsvp/actions.ts            lookupCode, submitRsvp server actions
app/rsvp/[code]/page.tsx       Party page (dynamic; the QR code points here)
app/rsvp/[code]/RsvpForm.tsx   Client component using useActionState
app/rsvp/[code]/not-found.tsx  Friendly "we couldn't find that code" page
```

QR codes encode `${settings.site_url}/rsvp/XXXX-XXXX`. The page accepts the code with or without
the dash and in any case, normalizes it, and redirects to the canonical dashed form.

### `/rsvp` (code entry)
- Static page (no DB read) with one input. Uses the existing `SectionPageLayout`.
- `lookupCode` action: normalize, rate-limit by IP (see hardening), look up. On miss, log a
  `lookup_failed` event and return a field error. On hit, `redirect('/rsvp/XXXX-XXXX')`.

### `/rsvp/[code]` (party page)
Server component, rendered per request:
1. `await params`, normalize the code, load party + guests + settings. Unknown code → `notFound()`.
2. Read `headers()` for IP and user agent **before** calling `after()` (Server Components cannot
   call request APIs inside `after`; the docs are explicit on this).
3. `after(() => logView(...))` inserts the `view` event and bumps the party's `view_count` /
   `last_viewed_at`. Skips logging when the user agent matches known link-preview bots
   (iMessage, Slack, WhatsApp, facebookexternalhit, etc.), and dedupes repeat loads from the same
   party + IP within 30 seconds so a refresh doesn't produce a second row.
4. Render:
   - Party name, list of named guests.
   - If `rsvp_open` is false: an "RSVPs open on ..." panel, no form.
   - If past deadline: read-only summary of their answers plus contact info.
   - Otherwise `RsvpForm` prefilled with existing answers.

### `RsvpForm`
Per named guest: attendance radio (`Both`, `Ceremony only`, `Reception only`, `Unable to attend`),
and a free-text allergies / dietary restrictions box.
If `plus_one_allowed`: a "I'm bringing a guest" toggle that reveals name fields and the same
per-guest block.
Party level: email (required), optional message to the couple.
Submit button shows pending state; success shows a confirmation panel with an "Edit response"
link back to the same page. Styling reuses the existing card and accent tokens.

### `submitRsvp` action
1. Validate the code again server-side (the form carries the code as a hidden field; the action
   does not trust client-side state).
2. Reject if `rsvp_open` is false or the deadline has passed.
3. Validate payload with zod; return field errors via `useActionState`.
4. In one transaction: update `parties` (email, phone, message, `responded_at` if null,
   `last_response_at`), upsert named guests' answers by guest id (ids must belong to this party),
   create/update/delete the `plus_one` guest row.
5. Compute a field-level diff versus the prior state, insert a `submit` (first time) or `update`
   event with the diff as metadata.
6. `revalidatePath('/rsvp/[code]', 'page')` is unnecessary since the page is dynamic; return a
   success state and let the client re-render.

### Home page
Replace the hard-coded "RSVP Coming Soon" button label in [app/page.tsx](../app/page.tsx) with a
label driven by `settings.rsvp_open`. That makes the home page dynamic; acceptable, or keep the
home page static and simply change the label to "RSVP" when the feature ships.

---

## 5. Admin area

### Routes
```
app/admin/login/page.tsx                 Password form (outside the protected layout)
app/admin/layout.tsx                     Admin shell: nav, sign-out, calls requireAdmin()
app/admin/page.tsx                       Dashboard (stats + recent activity)
app/admin/parties/page.tsx               Party list with search/filter/sort
app/admin/parties/new/page.tsx           Create party
app/admin/parties/[id]/page.tsx          Party detail: edit, guests, response, QR, activity
app/admin/import/page.tsx                CSV import wizard
app/admin/qr/page.tsx                    Bulk QR download + print sheet
app/admin/responses/page.tsx             Guest-level response table + export
app/admin/activity/page.tsx              Global activity log
app/admin/settings/page.tsx              Settings form
app/admin/actions/*.ts                   Server actions grouped by area (auth, parties, import, settings)
app/api/admin/qr/[partyId]/route.ts      GET ?format=svg|png → single QR
app/api/admin/qr/all/route.ts            GET → ZIP of one SVG + one PNG per party
app/api/admin/export/parties/route.ts    GET → CSV (party, code, URL) for mail-merge
app/api/admin/export/responses/route.ts  GET → CSV (one row per guest)
app/api/admin/export/activity/route.ts   GET → CSV
```

Admin pages become dynamic automatically because `requireAdmin()` reads `cookies()`. The admin
layout still exports `export const dynamic = 'force-dynamic'` as a belt-and-braces guard so no
admin page can ever be captured at build time.

### Auth
- `lib/auth/session.ts`: `createSession()`, `verifySession()`, `deleteSession()` using `jose`
  with `SESSION_SECRET`. Cookie: `httpOnly`, `secure`, `sameSite: 'lax'`, `path: '/admin'`.
- `lib/auth/dal.ts`: `requireAdmin()` wrapped in React `cache()`; redirects to `/admin/login` when
  missing or invalid. Called at the top of every admin page, action, and route handler.
- `lib/auth/password.ts`: `scrypt` hash/verify with a constant-time compare. `ADMIN_PASSWORD_HASH`
  in env; `scripts/hash-password.ts` produces it.
- `proxy.ts`: matcher `/admin/:path*`; if no valid session cookie and path is not `/admin/login`,
  redirect to login. Cookie-only check, no DB access (per the docs' guidance on proxy cost).
- Login action is rate-limited (5 attempts per 15 minutes per IP, in-memory).

### Dashboard (`/admin`)
Stat tiles, each computed by a single aggregate query in `lib/rsvp/stats.ts`:
- Parties: total, responded, declined, viewed-but-not-responded, never viewed.
- Guests invited (named + plus-one capacity), attending ceremony, attending reception, declined,
  pending.
- Plus ones: allowed vs. accepted.
- Every allergy and dietary restriction reported by an attending guest.
- Response-rate line: responses per day since first card scan (simple SVG sparkline; no chart lib).
- "Recent activity" list: last 25 events with party links.
- "Needs attention": parties that viewed 3+ times without responding, responses missing an email.

### Party list (`/admin/parties`)
Table with columns: name, code, guests (count and names), plus one, status badge, last viewed,
last response, tags. Search box (name, guest name, code, email). Filters: status, tag,
viewed/not viewed. Sort by any column. Query params drive server-side filtering so the URL is
shareable. Row click → detail. Bulk actions: export selected as CSV, regenerate codes (with confirm).

### Party detail (`/admin/parties/[id]`)
- Edit party fields and named guests (add/remove/reorder). Admin can also fill in the RSVP on
  behalf of a guest (phone RSVPs); those save as `admin_edit` events.
- Code panel: code, full URL, copy button, QR preview (inline SVG from the route handler),
  download SVG/PNG, "Regenerate code" (invalidates the old one; logs `code_regenerated`).
- Response panel: current answers per guest, with timestamps.
- Activity panel: this party's events newest first, with the diff for submit/update events
  rendered as before/after.
- Delete party (confirm dialog; cascades guests and events).

### CSV import (`/admin/import`)
One row per guest, grouped by `party` name. Template downloadable from the page:
```
party,first_name,last_name,plus_one_allowed,email,tags,notes,code
The Aulenback Family,Jane,Aulenback,false,jane@example.com,family,,
The Aulenback Family,John,Aulenback,false,,family,,
Sam Rivera,Sam,Rivera,true,,work,Met at conference,
```
- `code` is optional; blank generates one. Supplying it lets you re-import a corrected list
  without changing cards already printed.
- Step 1: paste or upload → parse with `csv-parse` → zod-validate each row → show a preview table
  with per-row errors, and a summary (N parties, M guests, K conflicts).
- Step 2: choose conflict handling for parties whose name already exists: skip, update guests,
  or replace. Then commit in one transaction and log an `import` event with counts.
- Upload goes through a server action; raise `experimental.serverActions.bodySizeLimit` to `2mb`
  in `next.config.ts` to be safe.

### QR generation (`/admin/qr`)
- Uses `settings.site_url` + `/rsvp/XXXX-XXXX`. Warn loudly if `site_url` is unset or not https.
- Bulk ZIP: `party-slug__XXXX-XXXX.svg` and `.png` (1024 px, quiet zone 4 modules, error
  correction level M). Filenames include the code so the print shop can match cards to parties.
- Print sheet: a printable HTML page (`@media print`) laying out each party's name, code, and QR
  in a grid, for a quick physical check or for DIY cards.
- Mail-merge CSV export: `party,code,url,guest_names` for whatever design tool produces the cards.

### Responses (`/admin/responses`)
Guest-level table (party, guest, kind, status, allergies, email, last updated) with
filters and a CSV export shaped for the caterer and the seating chart.

### Activity log (`/admin/activity`)
Paginated table (100 per page) with filters: type, party, date range, IP. Failed lookups are
shown with the attempted code so typos on cards can be spotted.

### Settings (`/admin/settings`)
Form for every `settings` column. Meal options are an editable list; removing an option that
guests have already chosen is blocked with a count.

---

## 6. Shared library layout
```
lib/
  db/
    index.ts        lazy singleton postgres.js client + drizzle(); DATABASE_URL from env; never connects at import time
    schema.ts       Drizzle tables + inferred types
    migrate.ts      runMigrations() used by instrumentation.ts
  auth/
    session.ts, dal.ts, password.ts, rate-limit.ts
  rsvp/
    codes.ts        generateCode(), normalizeCode(), formatCode(), isValidCodeShape()
    queries.ts      getPartyByCode(), getPartyById(), listParties(filters), ...
    responses.ts    saveGuestResponse() transaction + diff
    activity.ts     logEvent(), isPreviewBot(), shouldDedupeView()
    stats.ts        dashboard aggregates
    csv.ts          parseImportCsv(), buildResponsesCsv(), buildPartiesCsv()
    qr.ts           renderQrSvg(), renderQrPng(), buildQrZip()
    settings.ts     getSettings() (cached per request with React cache())
  validation/
    rsvp.ts, party.ts, import.ts, settings.ts   zod schemas
drizzle/            generated SQL migrations (committed)
drizzle.config.ts
instrumentation.ts  register(): run migrations when NEXT_RUNTIME === 'nodejs'
proxy.ts
scripts/
  hash-password.ts
  seed.ts           dev-only: settings row + a few sample parties (runs against the compose db)
```
Every server-only module imports `server-only` at the top so it can never leak into a client bundle.

---

## 7. Deployment changes

**Dockerfile**
- Copy `drizzle/` into the runner image (standalone tracing won't include it):
  `COPY --from=builder /app/drizzle ./drizzle`.
- No other changes; postgres.js is pure JS so the Alpine runner needs nothing extra.

**docker-compose.yaml (production)**
The existing file keeps its two services. The app just gains environment slots for the external
database and secrets:
```yaml
services:
  app:
    image: docker.abck.ca/rsvp:latest
    restart: unless-stopped
    stop_grace_period: 20s   # let after() callbacks finish on shutdown
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
      - DATABASE_URL=${DATABASE_URL}
      - DATABASE_SSL=${DATABASE_SSL:-require}
      - SESSION_SECRET=${SESSION_SECRET}
      - ADMIN_PASSWORD_HASH=${ADMIN_PASSWORD_HASH}
      - NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
  cloudflared:
    # unchanged
```
`DATABASE_URL` points at the existing Postgres server, e.g.
`postgres://rsvp:<password>@db.internal:5432/rsvp`. The app expects the database and role to
already exist; it creates its own tables on first start via migrations, so the role needs
`CREATE` on the database's `public` schema (or a dedicated schema named in the URL's
`?options=-c search_path=rsvp`). Alternatively, a separate `DATABASE_URL` plus `PGSSLMODE`
pair can be used if the existing server's convention is libpq-style variables; the driver reads
both.

**docker-compose.dev.yaml (development only)**
A separate file, never used in production, adds a throwaway Postgres for `pnpm dev`,
`drizzle-kit`, tests, and the seed script:
```yaml
services:
  db:
    image: postgres:17-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=rsvp
      - POSTGRES_PASSWORD=rsvp
      - POSTGRES_DB=rsvp
    volumes:
      - pgdata-dev:/var/lib/postgresql/data
volumes:
  pgdata-dev:
```
Run with `docker compose -f docker-compose.dev.yaml up -d db`. The dev `.env` sets
`DATABASE_URL=postgres://rsvp:rsvp@localhost:5432/rsvp` and `DATABASE_SSL=disable`.

**Backups**: the existing server's backup regime covers the data. The README documents the
one-off `pg_dump -Fc` / `pg_restore` commands against `DATABASE_URL` for taking a snapshot before
a risky import or code regeneration.

**Environment variables**
| name | purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string to the existing server. |
| `DATABASE_SSL` | `require` (default), `verify-full`, or `disable`. Maps to the driver's `ssl` option. Use `disable` only for the local dev container or a private network. |
| `SESSION_SECRET` | 32+ random bytes, base64 |
| `ADMIN_PASSWORD_HASH` | output of `scripts/hash-password.ts` |
| `NEXT_PUBLIC_SITE_URL` | fallback for `settings.site_url` and used for absolute links |

**Build-time safety**: the DB client is created lazily on first query, migrations run only in
`register()`, and every DB-reading page is dynamic. `pnpm build` in the Docker builder stage must
succeed with no database reachable. This will be verified as part of Phase 0.

**Startup**: `register()` connects with a short retry loop (10 attempts, 2 s apart) before
running migrations, then fails loudly if the database is still unreachable so the container
restarts instead of serving 500s. Migrations run under Drizzle's advisory lock, so a redeploy that
briefly overlaps the old container is safe.

---

## 8. Hardening checklist
- Access codes are bearer tokens: never list them in any guest-facing response, never log them in
  plaintext in server logs (only the DB `lookup_failed` metadata for admin review).
- Rate limit: code lookups (20 per 10 min per IP), RSVP submits (10 per 10 min per code), admin
  login (5 per 15 min per IP). In-memory `Map` with sweep; fine for one instance.
- Real client IP comes from `cf-connecting-ip`; only trust it because the app is only reachable
  through the Cloudflare tunnel.
- All server actions re-derive authorization inside the action (`requireAdmin()` or code lookup).
  Guest IDs in the submit payload are checked against the party before writing.
- Session cookie scoped to `/admin`; guests never receive a cookie.
- `Cache-Control: private, no-store` on the party page and all admin responses (route handlers
  set it explicitly; dynamic pages already get it).
- CSV export values that start with `= + - @` are prefixed with `'` to prevent spreadsheet
  formula injection.
- QR route handler validates `partyId` is an integer and `format` is one of the two allowed values.
- Security headers via `headers()` in `next.config.ts`: `X-Frame-Options: DENY` for `/admin`,
  `Referrer-Policy: strict-origin-when-cross-origin` site-wide so codes in URLs aren't leaked
  to third parties via referrer (Google Maps link on the home page, etc.).

---

## 9. Implementation phases

Each phase ends with `pnpm lint`, `pnpm build`, and a manual check. Later phases depend on earlier
ones in order.

**Phase 0: Foundations** (half a day)
1. Add deps: `drizzle-orm postgres zod jose qrcode fflate csv-parse csv-stringify server-only`;
   dev: `drizzle-kit vitest @types/qrcode tsx`.
2. Add `docker-compose.dev.yaml` with the dev Postgres and bring it up locally. Add the new env
   slots to the production compose file and `.env.example`.
3. `lib/db/*`, `drizzle.config.ts` (dialect `postgresql`), initial migration for all tables,
   enums, and indexes; `instrumentation.ts` with the retry loop.
4. `scripts/seed.ts`, `scripts/hash-password.ts`, `.env.example`.
5. Dockerfile changes. Prove `docker compose build` succeeds with no database reachable, and that
   the image, pointed at an empty database via `DATABASE_URL`, migrates it before serving.
6. `vitest` config + first tests for `codes.ts`. Tests that need a database run against the
   local compose Postgres using a throwaway schema per run.

**Phase 1: Guest flow** (1 day)
1. `/rsvp` code entry + `lookupCode` action + rate limiting.
2. `/rsvp/[code]` page, `RsvpForm`, `submitRsvp` action, not-found page.
3. View logging via `after()` with bot filtering and dedupe.
4. Open/closed/deadline states. Update the home page CTA.

**Phase 2: Admin auth and shell** (half a day)
1. Session, password, DAL, `proxy.ts`, login page and action, sign-out.
2. Admin layout with nav; empty dashboard page proving protection works (direct POST to an action
   without a cookie must be rejected).

**Phase 3: Party management** (1 day)
1. List page with filters/sort/search backed by query params.
2. Create/edit/delete party and guests; admin-side RSVP editing with `admin_edit` events.
3. Party detail with code panel and per-party activity.

**Phase 4: CSV import** (half a day)
1. Parser + validation + tests with a fixture file covering quotes, BOM, blank codes, duplicates.
2. Two-step wizard UI with conflict handling.

**Phase 5: QR codes and exports** (half a day)
1. `qr.ts`, single and bulk route handlers, print sheet.
2. Parties CSV (mail-merge), responses CSV, activity CSV.

**Phase 6: Dashboard, responses, activity** (1 day)
1. `stats.ts` aggregates with tests against seeded data.
2. Dashboard tiles, sparkline, needs-attention list.
3. Responses table, global activity log with pagination and filters.

**Phase 7: Settings and polish** (half a day)
1. Settings page for the open/closed switch, deadline, site URL, and event names.
2. Security headers, `Cache-Control`, formula-injection escaping.
3. Mobile pass on the guest form (most scans will be on phones).
4. README section: env setup, first-run, backup/restore, printing workflow.

Rough total: 5 to 6 working days.

---

## 10. Open assumptions

These are the calls made in this plan. Change any of them and the affected section adjusts, but
none block starting Phase 0.

1. One shared admin password is enough; no per-person admin accounts.
2. The existing production Postgres server already has (or will be given) a database and role
   for this app, and that role can create tables in it. The app never creates databases or roles.
3. Attendance is answered per guest, not per party, so one person in a party can decline while
   another attends.
4. Extra guests are modeled as additional guest rows the party creates, with the
   same questions. A party may be granted up to three.
5. Import format is one row per guest with a `party` grouping column (versus one row per party
   with guests joined by `;`).
6. QR codes point straight at `/rsvp/XXXX-XXXX`; no shorter vanity path.
7. Guests can edit their response any time until the deadline; there is no "lock after submit".
8. No email confirmations in this iteration. The collected email address is for the couple's
   use and possible future sending.
