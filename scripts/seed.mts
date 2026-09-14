/**
 * Development seed. Usage: pnpm db:seed
 * Safe to re-run: it clears parties and reinserts the sample set.
 */
import { db, sql } from "./_client.mjs";
import {
  activityEvents,
  guests,
  parties,
  settings,
} from "../lib/db/schema";
import { generateUniqueCodes } from "../lib/rsvp/codes";

const SAMPLE = [
  {
    name: "The Aulenback Family",
    plusOnesAllowed: 0,
    tags: ["groom-family"],
    guests: [
      ["Robert", "Aulenback"],
      ["Susan", "Aulenback"],
    ],
  },
  {
    name: "Morgan Household",
    plusOnesAllowed: 0,
    tags: ["bride-family"],
    guests: [
      ["Patricia", "Morgan"],
      ["David", "Morgan"],
      ["Ellie", "Morgan"],
    ],
  },
  {
    name: "Sam Rivera",
    plusOnesAllowed: 2,
    tags: ["work"],
    guests: [["Sam", "Rivera"]],
  },
  {
    name: "Dana and Kit Chen",
    plusOnesAllowed: 0,
    tags: ["friends"],
    guests: [
      ["Dana", "Chen"],
      ["Kit", "Chen"],
    ],
  },
  {
    name: "Alex Okafor",
    plusOnesAllowed: 2,
    tags: ["friends", "work"],
    guests: [["Alex", "Okafor"]],
  },
];

await db.delete(activityEvents);
await db.delete(guests);
await db.delete(parties);

await db
  .insert(settings)
  .values({
    id: 1,
    rsvpOpen: true,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  })
  .onConflictDoUpdate({
    target: settings.id,
    set: { rsvpOpen: true },
  });

const codes = generateUniqueCodes(SAMPLE.length);

for (const [index, sample] of SAMPLE.entries()) {
  const [party] = await db
    .insert(parties)
    .values({
      code: codes[index],
      name: sample.name,
      plusOnesAllowed: sample.plusOnesAllowed,
      tags: sample.tags,
    })
    .returning();

  await db.insert(guests).values(
    sample.guests.map(([firstName, lastName], order) => ({
      partyId: party.id,
      kind: "named" as const,
      firstName,
      lastName,
      sortOrder: order,
    })),
  );

  console.log(
    `${sample.name.padEnd(24)} ${codes[index].slice(0, 4)}-${codes[index].slice(4)}`,
  );
}

console.log(`\nSeeded ${SAMPLE.length} parties.`);

await sql.end();
