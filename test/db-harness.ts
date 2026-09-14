import { existsSync } from "node:fs";
import path from "node:path";

import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/lib/db/schema";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const BASE_URL =
  process.env.DATABASE_URL ?? "postgres://rsvp:rsvp@localhost:5432/rsvp";

const SSL =
  (process.env.DATABASE_SSL ?? "disable").toLowerCase() === "disable"
    ? false
    : ("require" as const);

function withDatabase(name: string): string {
  return BASE_URL.replace(/\/[^/?]+(\?|$)/, `/${name}$1`);
}

const ADMIN_URL = withDatabase("postgres");

/** True when a Postgres we can create databases on is reachable. */
export async function databaseReachable(): Promise<boolean> {
  const sql = postgres(ADMIN_URL, { ssl: SSL, max: 1, connect_timeout: 3 });

  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    await sql.end({ timeout: 2 });
  }
}

export type TestDatabase = {
  url: string;
  sql: postgres.Sql;
  db: ReturnType<typeof drizzle<typeof schema>>;
  teardown: () => Promise<void>;
};

/**
 * Creates a throwaway database and applies the real migrations to it, so these
 * tests exercise the same schema production gets. The name includes the worker
 * pid so parallel test files never collide.
 */
export async function createTestDatabase(
  label: string,
): Promise<TestDatabase> {
  const name = `rsvp_test_${label}_${process.pid}`;
  const admin = postgres(ADMIN_URL, { ssl: SSL, max: 1 });

  await admin.unsafe(`drop database if exists "${name}"`);
  await admin.unsafe(`create database "${name}"`);
  await admin.end({ timeout: 5 });

  const url = withDatabase(name);
  const sql = postgres(url, { ssl: SSL, max: 2, onnotice: () => {} });
  const db = drizzle(sql, { schema });

  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });

  return {
    url,
    sql,
    db,
    teardown: async () => {
      await sql.end({ timeout: 5 });
      const cleanup = postgres(ADMIN_URL, { ssl: SSL, max: 1 });
      await cleanup.unsafe(`drop database if exists "${name}"`);
      await cleanup.end({ timeout: 5 });
    },
  };
}
