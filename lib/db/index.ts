import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

let client: postgres.Sql | undefined;
let database: Database | undefined;

function sslOption(): postgres.Options<Record<string, never>>["ssl"] {
  const mode = (process.env.DATABASE_SSL ?? "require").toLowerCase();

  switch (mode) {
    case "disable":
    case "false":
    case "off":
      return false;
    case "verify-full":
    case "verify_full":
      return "verify-full";
    case "prefer":
      return "prefer";
    default:
      // `require` encrypts without validating the chain, which is what a
      // private-network Postgres with a self-signed cert needs.
      return "require";
  }
}

/**
 * Lazily create the postgres.js client. Nothing connects at import time, so a
 * `next build` with no database reachable still succeeds.
 */
export function getClient(): postgres.Sql {
  if (!client) {
    const url = process.env.DATABASE_URL;

    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. Copy .env.example to .env and set it.",
      );
    }

    client = postgres(url, {
      ssl: sslOption(),
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      idle_timeout: 30,
      connect_timeout: 10,
      onnotice: () => {},
    });
  }

  return client;
}

export function getDb(): Database {
  if (!database) {
    database = drizzle(getClient(), { schema });
  }

  return database;
}

/**
 * Proxy so call sites can write `db.select()` while the real connection is
 * still created on first use.
 */
export const db = new Proxy({} as Database, {
  get(_target, property, receiver) {
    return Reflect.get(getDb(), property, receiver);
  },
});

/**
 * Closes the pool. Used by integration tests so a throwaway database can be
 * dropped, and available for a graceful shutdown hook if one is ever added.
 */
export async function closeDb(): Promise<void> {
  if (client) {
    const open = client;
    client = undefined;
    database = undefined;
    await open.end({ timeout: 5 });
  }
}

export { schema };
