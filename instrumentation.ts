/**
 * Runs once per server start, before the first request is served.
 * Applying migrations here is what lets the standalone container bring itself
 * up against an empty database with no separate migrate step.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  if (process.env.SKIP_DB_MIGRATE === "1") {
    console.log("[db] SKIP_DB_MIGRATE=1, skipping migrations");
    return;
  }

  const { runMigrations } = await import("@/lib/db/migrate");

  await runMigrations();
}
