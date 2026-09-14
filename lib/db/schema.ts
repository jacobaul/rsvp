import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** Postgres `inet`. Drizzle has no first-class inet type, so declare it. */
const inet = customType<{ data: string; driverData: string }>({
  dataType() {
    return "inet";
  },
});

export const guestKind = pgEnum("guest_kind", ["named", "plus_one"]);

export const rsvpStatus = pgEnum("rsvp_status", [
  "pending",
  "both",
  "ceremony",
  "reception",
  "declined",
]);

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  rsvpOpen: boolean("rsvp_open").notNull().default(false),
  rsvpDeadline: timestamp("rsvp_deadline", { withTimezone: true }),
  siteUrl: text("site_url").notNull().default(""),
  ceremonyLabel: text("ceremony_label").notNull().default("Ceremony"),
  receptionLabel: text("reception_label").notNull().default("Reception"),
  ceremonyEnabled: boolean("ceremony_enabled").notNull().default(true),
  receptionEnabled: boolean("reception_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const parties = pgTable(
  "parties",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    /** How many extra guests this party may bring, 0 to MAX_PLUS_ONES. */
    plusOnesAllowed: integer("plus_ones_allowed").notNull().default(0),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    adminNotes: text("admin_notes"),
    guestMessage: text("guest_message"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    lastResponseAt: timestamp("last_response_at", { withTimezone: true }),
    firstViewedAt: timestamp("first_viewed_at", { withTimezone: true }),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
    viewCount: integer("view_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("parties_code_key").on(table.code),
    index("parties_tags_idx").using("gin", table.tags),
  ],
);

export const guests = pgTable(
  "guests",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    partyId: integer("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "cascade" }),
    kind: guestKind("kind").notNull().default("named"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    rsvpStatus: rsvpStatus("rsvp_status").notNull().default("pending"),
    /** Allergies and dietary restrictions, free text from the guest. */
    dietaryNotes: text("dietary_notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("guests_party_id_idx").on(table.partyId)],
);

/**
 * Upper bound on extra guests per party. The count is stored per party, so
 * raising this only needs the constant and the check constraint to change.
 */
export const MAX_PLUS_ONES = 3;

export const ACTIVITY_TYPES = [
  "view",
  "submit",
  "update",
  "lookup_failed",
  "admin_edit",
  "admin_create",
  "admin_delete",
  "code_regenerated",
  "import",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const activityEvents = pgTable(
  "activity_events",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    partyId: integer("party_id").references(() => parties.id, {
      onDelete: "cascade",
    }),
    type: text("type").$type<ActivityType>().notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ip: inet("ip"),
    userAgent: text("user_agent"),
    path: text("path"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  },
  (table) => [
    index("activity_party_occurred_idx").on(
      table.partyId,
      table.occurredAt.desc(),
    ),
    index("activity_occurred_idx").on(table.occurredAt.desc()),
  ],
);

export type Party = typeof parties.$inferSelect;
export type NewParty = typeof parties.$inferInsert;
export type Guest = typeof guests.$inferSelect;
export type NewGuest = typeof guests.$inferInsert;
export type ActivityEvent = typeof activityEvents.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type GuestKind = (typeof guestKind.enumValues)[number];
export type RsvpStatusValue = (typeof rsvpStatus.enumValues)[number];
