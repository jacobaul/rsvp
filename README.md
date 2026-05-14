# RSVP Worker App

A Cloudflare Workers + Cloudflare D1 app for wedding invite tracking and RSVP collection.

## Features

- Public invite portal (`/`) with invite-code + password protection
- RSVP form (`/rsvp`) with attendance, guest count, dietary notes, and message
- Password-protected admin interface (`/admin`)
- Admin CSV upload for invitees
- Admin CSV export for invitees + RSVP responses
- Data persisted in Cloudflare D1

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create D1 database and update `wrangler.toml` `database_id`:

   ```bash
   npx wrangler d1 create rsvp
   ```

3. Set secrets:

   ```bash
   npx wrangler secret put ADMIN_PASSWORD
   npx wrangler secret put SESSION_SECRET
   ```

4. Run migrations:

   ```bash
   npx wrangler d1 migrations apply rsvp --local
   npx wrangler d1 migrations apply rsvp --remote
   ```

5. Run locally:

   ```bash
   npx wrangler dev --local
   ```

6. Deploy:

   ```bash
   npx wrangler deploy
   ```

## Invite Upload CSV

Headers required:

```csv
invite_code,name,email,password,max_guests
```

Each invitee can have the same or different password.
