import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestDatabase, databaseReachable, type TestDatabase } from "@/test/db-harness";

const reachable = await databaseReachable();

/**
 * These exercise the real save transaction against real Postgres. They are
 * skipped when no database is reachable so `pnpm test` still passes on a
 * machine without the dev container running.
 */
describe.skipIf(!reachable)("saveRsvpResponse", () => {
  let harness: TestDatabase;
  let saveRsvpResponse: typeof import("../responses").saveRsvpResponse;
  let getPartyByCode: typeof import("../queries").getPartyByCode;
  let tables: typeof import("@/lib/db/schema");

  beforeAll(async () => {
    harness = await createTestDatabase("responses");
    // lib/db reads DATABASE_URL lazily on first query, so point it at the
    // throwaway database before anything imports it.
    process.env.DATABASE_URL = harness.url;
    process.env.DATABASE_SSL = "disable";

    tables = await import("@/lib/db/schema");
    ({ saveRsvpResponse } = await import("../responses"));
    ({ getPartyByCode } = await import("../queries"));
  });

  afterAll(async () => {
    // lib/db holds its own pool against the test database; it must close
    // before the database can be dropped.
    const { closeDb } = await import("@/lib/db");
    await closeDb();
    await harness?.teardown();
  });

  beforeEach(async () => {
    await harness.db.delete(tables.activityEvents);
    await harness.db.delete(tables.guests);
    await harness.db.delete(tables.parties);
  });

  async function seedParty(options: { plusOnesAllowed?: number } = {}) {
    const [party] = await harness.db
      .insert(tables.parties)
      .values({
        code: "TESTCODE",
        name: "Test Party",
        plusOnesAllowed: options.plusOnesAllowed ?? 0,
      })
      .returning();

    await harness.db.insert(tables.guests).values([
      { partyId: party.id, kind: "named", firstName: "Ann", lastName: "Smith", sortOrder: 0 },
      { partyId: party.id, kind: "named", firstName: "Bob", lastName: "Smith", sortOrder: 1 },
    ]);

    return (await getPartyByCode("TESTCODE"))!;
  }

  it("stores answers and marks the party responded", async () => {
    const party = await seedParty();
    const [ann, bob] = party.guests;

    const result = await saveRsvpResponse(
      party,
      {
        code: "TESTCODE",
        email: "ann@example.com",
        phone: "",
        guestMessage: "Looking forward to it",
        guests: [
          { guestId: ann.id, rsvpStatus: "both", dietaryNotes: "Severe nut allergy" },
          { guestId: bob.id, rsvpStatus: "declined", dietaryNotes: "" },
        ],
      },
    );

    expect(result.isFirstResponse).toBe(true);

    const saved = (await getPartyByCode("TESTCODE"))!;
    expect(saved.email).toBe("ann@example.com");
    expect(saved.respondedAt).not.toBeNull();
    expect(saved.lastResponseAt).not.toBeNull();

    const savedAnn = saved.guests.find((g) => g.id === ann.id)!;
    expect(savedAnn.rsvpStatus).toBe("both");
    expect(savedAnn.dietaryNotes).toBe("Severe nut allergy");

    const savedBob = saved.guests.find((g) => g.id === bob.id)!;
    expect(savedBob.rsvpStatus).toBe("declined");
  });

  it("keeps allergies for anyone attending, whichever events they chose", async () => {
    const party = await seedParty();
    const [ann, bob] = party.guests;

    await saveRsvpResponse(party, {
      code: "TESTCODE",
      email: "ann@example.com",
      phone: "",
      guestMessage: "",
      guests: [
        { guestId: ann.id, rsvpStatus: "ceremony", dietaryNotes: "Coeliac" },
        { guestId: bob.id, rsvpStatus: "reception", dietaryNotes: "Vegan" },
      ],
    });

    const saved = (await getPartyByCode("TESTCODE"))!;
    expect(saved.guests.find((g) => g.id === ann.id)!.dietaryNotes).toBe(
      "Coeliac",
    );
    expect(saved.guests.find((g) => g.id === bob.id)!.dietaryNotes).toBe(
      "Vegan",
    );
  });

  it("clears allergies for a guest who is not coming", async () => {
    const party = await seedParty();
    const [ann, bob] = party.guests;

    await saveRsvpResponse(party, {
      code: "TESTCODE",
      email: "ann@example.com",
      phone: "",
      guestMessage: "",
      guests: [
        { guestId: ann.id, rsvpStatus: "both", dietaryNotes: "Shellfish" },
        // Declining but a note was still posted; there is nothing to cater for.
        { guestId: bob.id, rsvpStatus: "declined", dietaryNotes: "Vegetarian" },
      ],
    });

    const saved = (await getPartyByCode("TESTCODE"))!;
    expect(saved.guests.find((g) => g.id === ann.id)!.dietaryNotes).toBe(
      "Shellfish",
    );
    expect(saved.guests.find((g) => g.id === bob.id)!.dietaryNotes).toBeNull();
  });

  it("records an allergy change in the change log", async () => {
    const party = await seedParty();
    const [ann, bob] = party.guests;

    const submission = {
      code: "TESTCODE",
      email: "ann@example.com",
      phone: "",
      guestMessage: "",
      guests: [
        { guestId: ann.id, rsvpStatus: "both" as const, dietaryNotes: "Nuts" },
        { guestId: bob.id, rsvpStatus: "both" as const, dietaryNotes: "" },
      ],
    };

    await saveRsvpResponse(party, submission);

    const first = (await getPartyByCode("TESTCODE"))!;
    const second = await saveRsvpResponse(first, {
      ...submission,
      guests: [
        { guestId: ann.id, rsvpStatus: "both", dietaryNotes: "Nuts, dairy" },
        { guestId: bob.id, rsvpStatus: "both", dietaryNotes: "" },
      ],
    });

    const change = second.changes.find((entry) =>
      entry.label.includes("dietary notes"),
    )!;
    expect(change.from).toBe("Nuts");
    expect(change.to).toBe("Nuts, dairy");
  });

  it("ignores guest ids that belong to another party", async () => {
    const party = await seedParty();
    const [ann, bob] = party.guests;

    const [other] = await harness.db
      .insert(tables.parties)
      .values({ code: "OTHERCOD", name: "Other Party" })
      .returning();
    const [victim] = await harness.db
      .insert(tables.guests)
      .values({ partyId: other.id, kind: "named", firstName: "Eve", lastName: "Other" })
      .returning();

    await saveRsvpResponse(
      party,
      {
        code: "TESTCODE",
        email: "ann@example.com",
        phone: "",
        guestMessage: "",
        guests: [
          { guestId: ann.id, rsvpStatus: "both", dietaryNotes: "" },
          { guestId: bob.id, rsvpStatus: "both", dietaryNotes: "" },
          // Crafted: another party's guest.
          { guestId: victim.id, rsvpStatus: "declined", dietaryNotes: "" },
        ],
      },
    );

    const untouched = (await getPartyByCode("OTHERCOD"))!;
    expect(untouched.guests[0].rsvpStatus).toBe("pending");
  });

  it("records a submit event first, then update events", async () => {
    const party = await seedParty();
    const [ann, bob] = party.guests;

    const submission = {
      code: "TESTCODE",
      email: "ann@example.com",
      phone: "",
      guestMessage: "",
      guests: [
        { guestId: ann.id, rsvpStatus: "both" as const, dietaryNotes: "" },
        { guestId: bob.id, rsvpStatus: "both" as const, dietaryNotes: "" },
      ],
    };

    await saveRsvpResponse(party, submission);

    const afterFirst = (await getPartyByCode("TESTCODE"))!;
    const second = await saveRsvpResponse(
      afterFirst,
      {
        ...submission,
        guests: [
          { guestId: ann.id, rsvpStatus: "declined", dietaryNotes: "" },
          { guestId: bob.id, rsvpStatus: "both", dietaryNotes: "" },
        ],
      },
    );

    expect(second.isFirstResponse).toBe(false);

    const events = await harness.db.select().from(tables.activityEvents);
    const types = events.map((event) => event.type).sort();
    expect(types).toEqual(["submit", "update"]);

    const update = events.find((event) => event.type === "update")!;
    const changes = update.metadata?.changes as { label: string; from: string | null; to: string | null }[];
    const attendance = changes.find((change) => change.label.includes("attendance"))!;
    expect(attendance.from).toBe("both");
    expect(attendance.to).toBe("declined");
  });

  it("keeps respondedAt at the first response across edits", async () => {
    const party = await seedParty();
    const [ann, bob] = party.guests;

    const submission = {
      code: "TESTCODE",
      email: "ann@example.com",
      phone: "",
      guestMessage: "",
      guests: [
        { guestId: ann.id, rsvpStatus: "both" as const, dietaryNotes: "" },
        { guestId: bob.id, rsvpStatus: "both" as const, dietaryNotes: "" },
      ],
    };

    await saveRsvpResponse(party, submission);
    const first = (await getPartyByCode("TESTCODE"))!;
    const firstRespondedAt = first.respondedAt!.getTime();

    await new Promise((resolve) => setTimeout(resolve, 50));
    await saveRsvpResponse(first, submission);

    const second = (await getPartyByCode("TESTCODE"))!;
    expect(second.respondedAt!.getTime()).toBe(firstRespondedAt);
    expect(second.lastResponseAt!.getTime()).toBeGreaterThanOrEqual(firstRespondedAt);
  });

  describe("additional guests", () => {
    function baseSubmission(annId: number, bobId: number) {
      return {
        code: "TESTCODE",
        email: "ann@example.com",
        phone: "",
        guestMessage: "",
        guests: [
          { guestId: annId, rsvpStatus: "both" as const, dietaryNotes: "" },
          { guestId: bobId, rsvpStatus: "both" as const, dietaryNotes: "" },
        ],
      };
    }

    it("adds a single extra guest", async () => {
      const party = await seedParty({ plusOnesAllowed: 1 });
      const [ann, bob] = party.guests;

      await saveRsvpResponse(
        party,
        {
          ...baseSubmission(ann.id, bob.id),
          plusOnes: [
            {
              firstName: "Cara",
              lastName: "Lee",
              rsvpStatus: "both",
              dietaryNotes: "No nuts",
            },
          ],
        },
      );

      const saved = (await getPartyByCode("TESTCODE"))!;
      const extras = saved.guests.filter((g) => g.kind === "plus_one");

      expect(extras).toHaveLength(1);
      expect(extras[0].firstName).toBe("Cara");
      expect(extras[0].dietaryNotes).toBe("No nuts");
    });

    it("adds up to three extra guests", async () => {
      const party = await seedParty({ plusOnesAllowed: 3 });
      const [ann, bob] = party.guests;

      await saveRsvpResponse(
        party,
        {
          ...baseSubmission(ann.id, bob.id),
          plusOnes: [
            { firstName: "One", lastName: "Guest", rsvpStatus: "both", dietaryNotes: "" },
            { firstName: "Two", lastName: "Guest", rsvpStatus: "ceremony", dietaryNotes: "" },
            { firstName: "Three", lastName: "Guest", rsvpStatus: "reception", dietaryNotes: "Gluten free" },
          ],
        },
      );

      const saved = (await getPartyByCode("TESTCODE"))!;
      const extras = saved.guests
        .filter((g) => g.kind === "plus_one")
        .sort((a, b) => a.sortOrder - b.sortOrder);

      expect(extras.map((g) => g.firstName)).toEqual(["One", "Two", "Three"]);
      expect(extras.map((g) => g.rsvpStatus)).toEqual([
        "both",
        "ceremony",
        "reception",
      ]);
      expect(extras[2].dietaryNotes).toBe("Gluten free");
    });

    it("keeps extra guests after the named guests in display order", async () => {
      const party = await seedParty({ plusOnesAllowed: 2 });
      const [ann, bob] = party.guests;

      await saveRsvpResponse(
        party,
        {
          ...baseSubmission(ann.id, bob.id),
          plusOnes: [
            { firstName: "Extra", lastName: "One", rsvpStatus: "both", dietaryNotes: "" },
          ],
        },
      );

      const saved = (await getPartyByCode("TESTCODE"))!;
      expect(saved.guests.map((g) => g.kind)).toEqual([
        "named",
        "named",
        "plus_one",
      ]);
    });

    it("ignores anything beyond the party's allowance", async () => {
      const party = await seedParty({ plusOnesAllowed: 1 });
      const [ann, bob] = party.guests;

      await saveRsvpResponse(
        party,
        {
          ...baseSubmission(ann.id, bob.id),
          plusOnes: [
            { firstName: "Allowed", lastName: "Guest", rsvpStatus: "both", dietaryNotes: "" },
            { firstName: "Extra", lastName: "Guest", rsvpStatus: "both", dietaryNotes: "" },
            { firstName: "Also", lastName: "Extra", rsvpStatus: "both", dietaryNotes: "" },
          ],
        },
      );

      const saved = (await getPartyByCode("TESTCODE"))!;
      const extras = saved.guests.filter((g) => g.kind === "plus_one");

      expect(extras).toHaveLength(1);
      expect(extras[0].firstName).toBe("Allowed");
    });

    it("ignores extra guests when the party is allowed none", async () => {
      const party = await seedParty({ plusOnesAllowed: 0 });
      const [ann, bob] = party.guests;

      await saveRsvpResponse(
        party,
        {
          ...baseSubmission(ann.id, bob.id),
          plusOnes: [
            { firstName: "Sneaky", lastName: "Guest", rsvpStatus: "both", dietaryNotes: "" },
          ],
        },
      );

      const saved = (await getPartyByCode("TESTCODE"))!;
      expect(saved.guests.some((g) => g.kind === "plus_one")).toBe(false);
    });

    it("edits an existing extra guest by id instead of duplicating", async () => {
      const party = await seedParty({ plusOnesAllowed: 2 });
      const [ann, bob] = party.guests;

      await saveRsvpResponse(
        party,
        {
          ...baseSubmission(ann.id, bob.id),
          plusOnes: [
            { firstName: "Cara", lastName: "Lee", rsvpStatus: "both", dietaryNotes: "" },
          ],
        },
      );

      const first = (await getPartyByCode("TESTCODE"))!;
      const existing = first.guests.find((g) => g.kind === "plus_one")!;

      await saveRsvpResponse(
        first,
        {
          ...baseSubmission(ann.id, bob.id),
          plusOnes: [
            {
              id: existing.id,
              firstName: "Cara",
              lastName: "Lee-Smith",
              rsvpStatus: "reception",
              dietaryNotes: "Vegetarian",
            },
          ],
        },
      );

      const second = (await getPartyByCode("TESTCODE"))!;
      const extras = second.guests.filter((g) => g.kind === "plus_one");

      expect(extras).toHaveLength(1);
      expect(extras[0].id).toBe(existing.id);
      expect(extras[0].lastName).toBe("Lee-Smith");
      expect(extras[0].dietaryNotes).toBe("Vegetarian");
    });

    it("removes only the extra guests left out of a later submission", async () => {
      const party = await seedParty({ plusOnesAllowed: 3 });
      const [ann, bob] = party.guests;

      await saveRsvpResponse(
        party,
        {
          ...baseSubmission(ann.id, bob.id),
          plusOnes: [
            { firstName: "Keep", lastName: "Me", rsvpStatus: "both", dietaryNotes: "" },
            { firstName: "Drop", lastName: "Me", rsvpStatus: "both", dietaryNotes: "" },
          ],
        },
      );

      const first = (await getPartyByCode("TESTCODE"))!;
      const keep = first.guests.find((g) => g.firstName === "Keep")!;

      await saveRsvpResponse(
        first,
        {
          ...baseSubmission(ann.id, bob.id),
          plusOnes: [
            {
              id: keep.id,
              firstName: "Keep",
              lastName: "Me",
              rsvpStatus: "both",
              dietaryNotes: "",
            },
          ],
        },
      );

      const second = (await getPartyByCode("TESTCODE"))!;
      const extras = second.guests.filter((g) => g.kind === "plus_one");

      expect(extras).toHaveLength(1);
      expect(extras[0].firstName).toBe("Keep");
    });

    it("removes every extra guest when none are submitted", async () => {
      const party = await seedParty({ plusOnesAllowed: 2 });
      const [ann, bob] = party.guests;

      await saveRsvpResponse(
        party,
        {
          ...baseSubmission(ann.id, bob.id),
          plusOnes: [
            { firstName: "Cara", lastName: "Lee", rsvpStatus: "both", dietaryNotes: "" },
          ],
        },
      );

      const first = (await getPartyByCode("TESTCODE"))!;
      expect(first.guests.some((g) => g.kind === "plus_one")).toBe(true);

      await saveRsvpResponse(
        first,
        { ...baseSubmission(ann.id, bob.id), plusOnes: [] },
      );

      const second = (await getPartyByCode("TESTCODE"))!;
      expect(second.guests.some((g) => g.kind === "plus_one")).toBe(false);
    });

    it("drops rows with no name at all", async () => {
      const party = await seedParty({ plusOnesAllowed: 3 });
      const [ann, bob] = party.guests;

      await saveRsvpResponse(
        party,
        {
          ...baseSubmission(ann.id, bob.id),
          plusOnes: [
            { firstName: "Real", lastName: "Guest", rsvpStatus: "both", dietaryNotes: "" },
            { firstName: "  ", lastName: "", rsvpStatus: "both", dietaryNotes: "" },
          ],
        },
      );

      const saved = (await getPartyByCode("TESTCODE"))!;
      expect(saved.guests.filter((g) => g.kind === "plus_one")).toHaveLength(1);
    });

    it("allows several plus_one rows for one party at the database level", async () => {
      const party = await seedParty({ plusOnesAllowed: 3 });

      await harness.db.insert(tables.guests).values([
        { partyId: party.id, kind: "plus_one", firstName: "First", lastName: "Guest" },
        { partyId: party.id, kind: "plus_one", firstName: "Second", lastName: "Guest" },
        { partyId: party.id, kind: "plus_one", firstName: "Third", lastName: "Guest" },
      ]);

      const saved = (await getPartyByCode("TESTCODE"))!;
      expect(saved.guests.filter((g) => g.kind === "plus_one")).toHaveLength(3);
    });

    it("records added and removed guests in the change log", async () => {
      const party = await seedParty({ plusOnesAllowed: 2 });
      const [ann, bob] = party.guests;

      const result = await saveRsvpResponse(
        party,
        {
          ...baseSubmission(ann.id, bob.id),
          plusOnes: [
            { firstName: "Cara", lastName: "Lee", rsvpStatus: "both", dietaryNotes: "" },
          ],
        },
      );

      expect(
        result.changes.some(
          (change) => change.field === "plusOne.added" && change.to === "Cara Lee",
        ),
      ).toBe(true);

      const first = (await getPartyByCode("TESTCODE"))!;
      const second = await saveRsvpResponse(
        first,
        { ...baseSubmission(ann.id, bob.id), plusOnes: [] },
      );

      expect(
        second.changes.some(
          (change) =>
            change.field === "plusOne.removed" && change.from === "Cara Lee",
        ),
      ).toBe(true);
    });
  });

  it("cascades guests and activity when a party is deleted", async () => {
    const party = await seedParty();

    await harness.db.insert(tables.activityEvents).values({
      partyId: party.id,
      type: "view",
    });

    await harness.db.delete(tables.parties);

    expect(await harness.db.select().from(tables.guests)).toHaveLength(0);
    expect(await harness.db.select().from(tables.activityEvents)).toHaveLength(0);
  });
});
