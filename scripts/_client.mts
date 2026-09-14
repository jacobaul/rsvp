/**
 * Standalone Drizzle client for CLI scripts. lib/db is marked `server-only`
 * so it cannot be imported outside the Next runtime; scripts open their own
 * short-lived connection instead.
 */
import { existsSync } from "node:fs";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../lib/db/schema";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const url = process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env first.");
  process.exit(1);
}

const sslMode = (process.env.DATABASE_SSL ?? "require").toLowerCase();
const ssl =
  sslMode === "disable" || sslMode === "false"
    ? false
    : sslMode === "verify-full"
      ? "verify-full"
      : "require";

export const sql = postgres(url, { ssl, max: 4, onnotice: () => {} });
export const db = drizzle(sql, { schema });
export { schema };
