import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createTestDatabase,
  databaseReachable,
  type TestDatabase,
} from "@/test/db-harness";

const reachable = await databaseReachable();

describe.skipIf(!reachable)("dashboard stats and activity", () => {
  let harness: TestDatabase;
  let getDashboardStats: typeof import("../stats").getDashboardStats;
  let logPartyView: typeof import("../activity").logPartyView;
  let partyStatus: typeof import("../queries").partyStatus;
  let getPartyByCode: typeof import("../queries").getPartyByCode;
  let listActivity: typeof import("../activity-log").listActivity;
  let tables: typeof import("@/lib/db/schema");

  beforeAll(async () => {
    harness = await createTestDatabase("stats");
    process.env.DATABASE_URL = harness.url;
    process.env.DATABASE_SSL = "disable";

    tables = await import("@/lib/db/schema");
    ({ getDashboardStats } = await import("../stats"));
    ({ logPartyView } = await import("../activity"));
    ({ partyStatus, getPartyByCode } = await import("../queries"));
    ({ listActivity } = await import("../activity-log"));
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

  async function makeParty(
    code: string,
    name: string,
    guests: {
      firstName: string;
      status: "pending" | "both" | "ceremony" | "reception" | "declined";
      dietaryNotes?: string;
    }[],
    options: { responded?: boolean; viewCount?: number } = {},
  ) {
    const [party] = await harness.db
      .insert(tables.parties)
      .values({
        code,
        name,
        viewCount: options.viewCount ?? 0,
        respondedAt: options.responded ? new Date() : null,
        lastResponseAt: options.responded ? new Date() : null,
      })
      .returning();

    await harness.db.insert(tables.guests).values(
      guests.map((guest, index) => ({
        partyId: party.id,
        kind: "named" as const,
        firstName: guest.firstName,
        lastName: "Test",
        sortOrder: index,
        rsvpStatus: guest.status,
        dietaryNotes: guest.dietaryNotes ?? null,
      })),
    );

    return party;
  }

  it("counts party statuses correctly", async () => {
    await makeParty("AAAAAAAA", "Responded", [
      { firstName: "A", status: "both" },
    ], { responded: true, viewCount: 2 });

    await makeParty("BBBBBBBB", "Declined", [
      { firstName: "B", status: "declined" },
      { firstName: "C", status: "declined" },
    ], { responded: true, viewCount: 1 });

    await makeParty("CCCCCCCC", "Viewed", [
      { firstName: "D", status: "pending" },
    ], { viewCount: 4 });

    await makeParty("DDDDDDDD", "Never opened", [
      { firstName: "E", status: "pending" },
    ]);

    const stats = await getDashboardStats();

    expect(stats.parties.total).toBe(4);
    expect(stats.parties.responded).toBe(1);
    expect(stats.parties.declined).toBe(1);
    expect(stats.parties.viewedNoReply).toBe(1);
    expect(stats.parties.neverViewed).toBe(1);
  });

  it("counts guests by event, not just by party", async () => {
    await makeParty("AAAAAAAA", "Mixed", [
      { firstName: "Both", status: "both" },
      { firstName: "Ceremony", status: "ceremony" },
      { firstName: "Reception", status: "reception" },
      { firstName: "Declined", status: "declined" },
      { firstName: "Pending", status: "pending" },
    ], { responded: true });

    const stats = await getDashboardStats();

    expect(stats.guests.invited).toBe(5);
    // Both + ceremony-only
    expect(stats.guests.attendingCeremony).toBe(2);
    // Both + reception-only
    expect(stats.guests.attendingReception).toBe(2);
    expect(stats.guests.attendingAny).toBe(3);
    expect(stats.guests.declined).toBe(1);
    expect(stats.guests.pending).toBe(1);
  });

  it("collects allergies from everyone attending", async () => {
    await makeParty("AAAAAAAA", "Allergies", [
      { firstName: "A", status: "both", dietaryNotes: "Nut allergy" },
      { firstName: "B", status: "reception", dietaryNotes: "Vegan" },
      { firstName: "C", status: "ceremony", dietaryNotes: "Celiac" },
      { firstName: "D", status: "both" },
    ], { responded: true });

    const stats = await getDashboardStats();

    expect(stats.dietaryCount).toBe(3);
    expect(stats.dietary.map((entry) => entry.notes).sort()).toEqual([
      "Celiac",
      "Nut allergy",
      "Vegan",
    ]);
  });

  it("ignores allergies from guests who are not attending", async () => {
    await makeParty("AAAAAAAA", "Not coming", [
      { firstName: "Declined", status: "declined", dietaryNotes: "Vegetarian" },
      { firstName: "Pending", status: "pending", dietaryNotes: "Dairy free" },
      { firstName: "Coming", status: "both", dietaryNotes: "Shellfish" },
    ], { responded: true });

    const stats = await getDashboardStats();

    expect(stats.dietaryCount).toBe(1);
    expect(stats.dietary[0].guestName).toBe("Coming Test");
  });

  it("names the party alongside each allergy so it can be chased", async () => {
    await makeParty("AAAAAAAA", "The Smiths", [
      { firstName: "Ann", status: "both", dietaryNotes: "Nut allergy" },
    ], { responded: true });

    const stats = await getDashboardStats();

    expect(stats.dietary[0]).toMatchObject({
      partyName: "The Smiths",
      guestName: "Ann Test",
      notes: "Nut allergy",
    });
  });

  it("flags parties that opened repeatedly without replying", async () => {
    await makeParty("AAAAAAAA", "Lurker", [
      { firstName: "A", status: "pending" },
    ], { viewCount: 5 });

    await makeParty("BBBBBBBB", "Once", [
      { firstName: "B", status: "pending" },
    ], { viewCount: 1 });

    const stats = await getDashboardStats();

    expect(stats.needsAttention.repeatViewersNoReply.map((p) => p.name)).toEqual(
      ["Lurker"],
    );
  });

  describe("view logging", () => {
    it("records a view and bumps the party counters", async () => {
      const party = await makeParty("AAAAAAAA", "Viewer", [
        { firstName: "A", status: "pending" },
      ]);

      await logPartyView({
        partyId: party.id,
        ip: "203.0.113.10",
        userAgent: "Mozilla/5.0 (Macintosh) Chrome/131.0",
        path: "/rsvp/AAAA-AAAA",
      });

      const saved = (await getPartyByCode("AAAAAAAA"))!;
      expect(saved.viewCount).toBe(1);
      expect(saved.firstViewedAt).not.toBeNull();
      expect(saved.lastViewedAt).not.toBeNull();
      expect(partyStatus(saved)).toBe("viewed");
    });

    it("dedupes repeat views from the same IP", async () => {
      const party = await makeParty("AAAAAAAA", "Refresher", [
        { firstName: "A", status: "pending" },
      ]);

      const view = {
        partyId: party.id,
        ip: "203.0.113.10",
        userAgent: "Mozilla/5.0 (Macintosh) Chrome/131.0",
        path: "/rsvp/AAAA-AAAA",
      };

      await logPartyView(view);
      await logPartyView(view);
      await logPartyView({ ...view, ip: "198.51.100.1" });

      const saved = (await getPartyByCode("AAAAAAAA"))!;
      expect(saved.viewCount).toBe(2);
    });

    it("ignores link-preview bots", async () => {
      const party = await makeParty("AAAAAAAA", "Bot bait", [
        { firstName: "A", status: "pending" },
      ]);

      for (const userAgent of [
        "facebookexternalhit/1.1",
        "WhatsApp/2.23",
        "Slackbot-LinkExpanding 1.0",
        "curl/8.4.0",
        null,
      ]) {
        await logPartyView({
          partyId: party.id,
          ip: "203.0.113.99",
          userAgent,
          path: "/rsvp/AAAA-AAAA",
        });
      }

      const saved = (await getPartyByCode("AAAAAAAA"))!;
      expect(saved.viewCount).toBe(0);
      expect(partyStatus(saved)).toBe("not_viewed");
    });
  });

  describe("activity log filters", () => {
    it("filters by type and pages results", async () => {
      const party = await makeParty("AAAAAAAA", "Busy", [
        { firstName: "A", status: "pending" },
      ]);

      await harness.db.insert(tables.activityEvents).values([
        { partyId: party.id, type: "view", ip: "203.0.113.1" },
        { partyId: party.id, type: "view", ip: "203.0.113.2" },
        { partyId: party.id, type: "submit", ip: "203.0.113.1" },
        { partyId: null, type: "lookup_failed", ip: "203.0.113.3" },
      ]);

      const views = await listActivity({ type: "view" });
      expect(views.total).toBe(2);

      const byIp = await listActivity({ ip: "203.0.113.1" });
      expect(byIp.total).toBe(2);

      const all = await listActivity({});
      expect(all.total).toBe(4);
      expect(all.page).toBe(1);
      expect(all.pageCount).toBe(1);
    });

    it("joins the party name and tolerates events with no party", async () => {
      const party = await makeParty("AAAAAAAA", "Named Party", [
        { firstName: "A", status: "pending" },
      ]);

      await harness.db.insert(tables.activityEvents).values([
        { partyId: party.id, type: "view" },
        { partyId: null, type: "lookup_failed", metadata: { attempted: "ZZZZZZZZ" } },
      ]);

      const { rows } = await listActivity({});
      const withParty = rows.find((row) => row.type === "view")!;
      const orphan = rows.find((row) => row.type === "lookup_failed")!;

      expect(withParty.partyName).toBe("Named Party");
      expect(orphan.partyName).toBeNull();
      expect(orphan.metadata).toMatchObject({ attempted: "ZZZZZZZZ" });
    });

    it("clamps an out-of-range page to the last page", async () => {
      const party = await makeParty("AAAAAAAA", "Busy", [
        { firstName: "A", status: "pending" },
      ]);

      await harness.db
        .insert(tables.activityEvents)
        .values({ partyId: party.id, type: "view" });

      const result = await listActivity({ page: 99 });
      expect(result.page).toBe(1);
      expect(result.rows).toHaveLength(1);
    });
  });

  it("derives declined only when every guest declines", async () => {
    const mixed = await makeParty("AAAAAAAA", "Mixed", [
      { firstName: "A", status: "declined" },
      { firstName: "B", status: "both" },
    ], { responded: true });

    const allDeclined = await makeParty("BBBBBBBB", "All out", [
      { firstName: "C", status: "declined" },
      { firstName: "D", status: "declined" },
    ], { responded: true });

    await harness.db
      .select()
      .from(tables.parties)
      .where(eq(tables.parties.id, mixed.id));

    expect(partyStatus((await getPartyByCode("AAAAAAAA"))!)).toBe("responded");
    expect(partyStatus((await getPartyByCode("BBBBBBBB"))!)).toBe("declined");
    expect(allDeclined.name).toBe("All out");
  });
});
