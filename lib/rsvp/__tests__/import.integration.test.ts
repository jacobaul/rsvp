import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createTestDatabase,
  databaseReachable,
  type TestDatabase,
} from "@/test/db-harness";
import { parseImportCsv } from "../csv-import";

const reachable = await databaseReachable();

describe.skipIf(!reachable)("CSV import against the database", () => {
  let harness: TestDatabase;
  let planImport: typeof import("../import").planImport;
  let commitImport: typeof import("../import").commitImport;
  let listParties: typeof import("../queries").listParties;
  let tables: typeof import("@/lib/db/schema");

  beforeAll(async () => {
    harness = await createTestDatabase("import");
    process.env.DATABASE_URL = harness.url;
    process.env.DATABASE_SSL = "disable";

    tables = await import("@/lib/db/schema");
    ({ planImport, commitImport } = await import("../import"));
    ({ listParties } = await import("../queries"));
  });

  afterAll(async () => {
    const { closeDb } = await import("@/lib/db");
    await closeDb();
    await harness?.teardown();
  });

  beforeEach(async () => {
    await harness.db.delete(tables.activityEvents);
    await harness.db.delete(tables.guests);
    await harness.db.delete(tables.parties);
  });

  async function importCsv(csv: string, mode: "skip" | "update" | "replace") {
    const parsed = parseImportCsv(csv);
    const plan = await planImport(parsed.parties);
    return commitImport(plan, mode);
  }

  const BASE_CSV = [
    "party,first_name,last_name,plus_ones_allowed,email,tags",
    "The Smiths,Ann,Smith,0,ann@example.com,family",
    "The Smiths,Bob,Smith,0,,family",
    "Cara Lee,Cara,Lee,2,,work",
  ].join("\n");

  it("creates parties and generates codes", async () => {
    const summary = await importCsv(BASE_CSV, "skip");

    expect(summary.created).toBe(2);
    expect(summary.guestsAdded).toBe(3);
    expect(summary.codesAssigned).toBe(2);

    const parties = await listParties({ sort: "name" });
    expect(parties.map((p) => p.name).sort()).toEqual(["Cara Lee", "The Smiths"]);

    const smiths = parties.find((p) => p.name === "The Smiths")!;
    expect(smiths.guests).toHaveLength(2);
    expect(smiths.email).toBe("ann@example.com");
    expect(smiths.tags).toEqual(["family"]);
    expect(smiths.code).toHaveLength(8);

    const cara = parties.find((p) => p.name === "Cara Lee")!;
    expect(cara.plusOnesAllowed).toBe(2);
    expect(cara.code).not.toBe(smiths.code);
  });

  it("honours a code supplied in the file", async () => {
    await importCsv(
      "party,first_name,code\nThe Smiths,Ann,ABCD-EFGH",
      "skip",
    );

    const [party] = await listParties();
    expect(party.code).toBe("ABCDEFGH");
  });

  it("skips existing parties in skip mode", async () => {
    await importCsv(BASE_CSV, "skip");

    const summary = await importCsv(
      "party,first_name,last_name\nThe Smiths,Ann,Smith\nThe Smiths,Zoe,Smith",
      "skip",
    );

    expect(summary.created).toBe(0);
    expect(summary.skipped).toBe(1);

    const smiths = (await listParties()).find((p) => p.name === "The Smiths")!;
    expect(smiths.guests.map((g) => g.firstName).sort()).toEqual(["Ann", "Bob"]);
  });

  it("adds only new guests in update mode, preserving answers", async () => {
    await importCsv(BASE_CSV, "skip");

    const before = (await listParties()).find((p) => p.name === "The Smiths")!;
    const ann = before.guests.find((g) => g.firstName === "Ann")!;

    await harness.db
      .update(tables.guests)
      .set({ rsvpStatus: "both", dietaryNotes: "Nut allergy" })
      .where(eq(tables.guests.id, ann.id));

    const summary = await importCsv(
      "party,first_name,last_name\nThe Smiths,Ann,Smith\nThe Smiths,Zoe,Smith",
      "update",
    );

    expect(summary.updated).toBe(1);
    expect(summary.guestsAdded).toBe(1);

    const after = (await listParties()).find((p) => p.name === "The Smiths")!;
    expect(after.guests.map((g) => g.firstName).sort()).toEqual([
      "Ann",
      "Bob",
      "Zoe",
    ]);

    const savedAnn = after.guests.find((g) => g.firstName === "Ann")!;
    expect(savedAnn.rsvpStatus).toBe("both");
    expect(savedAnn.dietaryNotes).toBe("Nut allergy");
  });

  it("rebuilds the guest list in replace mode", async () => {
    await importCsv(BASE_CSV, "skip");

    const summary = await importCsv(
      "party,first_name,last_name\nThe Smiths,Zoe,Smith",
      "replace",
    );

    expect(summary.updated).toBe(1);
    expect(summary.guestsRemoved).toBe(2);
    expect(summary.guestsAdded).toBe(1);

    const after = (await listParties()).find((p) => p.name === "The Smiths")!;
    expect(after.guests.map((g) => g.firstName)).toEqual(["Zoe"]);
  });

  it("keeps the existing code when a party is updated", async () => {
    await importCsv(BASE_CSV, "skip");
    const before = (await listParties()).find((p) => p.name === "The Smiths")!;

    await importCsv(
      "party,first_name,last_name\nThe Smiths,Ann,Smith",
      "update",
    );

    const after = (await listParties()).find((p) => p.name === "The Smiths")!;
    expect(after.code).toBe(before.code);
  });

  it("blocks a row whose code belongs to a different party", async () => {
    await importCsv("party,first_name,code\nThe Smiths,Ann,ABCD-EFGH", "skip");

    const parsed = parseImportCsv(
      "party,first_name,code\nOther Party,Zoe,ABCD-EFGH",
    );
    const plan = await planImport(parsed.parties);

    expect(plan.codeCollisions).toHaveLength(1);
    expect(plan.codeCollisions[0].ownerName).toBe("The Smiths");

    const summary = await commitImport(plan, "skip");
    expect(summary.created).toBe(0);
    expect(summary.skipped).toBe(1);
    expect(await listParties()).toHaveLength(1);
  });

  it("records an import event with the summary", async () => {
    await importCsv(BASE_CSV, "skip");

    const events = await harness.db.select().from(tables.activityEvents);
    const importEvent = events.find((event) => event.type === "import")!;

    expect(importEvent).toBeDefined();
    expect(importEvent.partyId).toBeNull();
    expect(importEvent.metadata).toMatchObject({ created: 2, mode: "skip" });
  });

  it("assigns distinct codes across a large import", async () => {
    const rows = ["party,first_name"];

    for (let index = 0; index < 200; index += 1) {
      rows.push(`Party ${index},Guest${index}`);
    }

    const summary = await importCsv(rows.join("\n"), "skip");
    expect(summary.created).toBe(200);

    const parties = await listParties();
    const codes = new Set(parties.map((party) => party.code));
    expect(codes.size).toBe(200);
  });
});
