import { existsSync } from "node:fs";

import { defineConfig } from "drizzle-kit";

// Node 22 built-in .env loader; drizzle-kit's CLI does not load .env for us.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://rsvp:rsvp@localhost:5432/rsvp",
  },
  strict: true,
  verbose: true,
});
