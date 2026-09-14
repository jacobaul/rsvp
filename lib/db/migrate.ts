import "server-only";

import path from "node:path";

import { migrate } from "drizzle-orm/postgres-js/migrator";

import { getClient, getDb } from "./index";

const MAX_ATTEMPTS = 10;
const RETRY_DELAY_MS = 2000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDatabase() {
  const sql = getClient();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await sql`select 1`;
      return;
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) {
        throw error;
      }

      console.warn(
        `[db] not reachable (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in ${
          RETRY_DELAY_MS / 1000
        }s`,
      );
      await sleep(RETRY_DELAY_MS);
    }
  }
}

/**
 * Applies any pending migrations. Drizzle's migrator takes a Postgres advisory
 * lock, so two containers starting at once is safe.
 */
export async function runMigrations() {
  await waitForDatabase();

  const migrationsFolder = path.join(process.cwd(), "drizzle");

  await migrate(getDb(), { migrationsFolder });
  console.log("[db] migrations up to date");
}
