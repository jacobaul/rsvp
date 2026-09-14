-- Meal preference is replaced by a single allergies / dietary restrictions
-- field. Fold any choice a guest already made into their notes first, so the
-- drop below cannot lose an answer someone gave.
UPDATE "guests"
SET "dietary_notes" = trim(both ' ' from
  coalesce(nullif("dietary_notes", ''), '') ||
  CASE WHEN nullif("dietary_notes", '') IS NULL THEN '' ELSE ' | ' END ||
  'previous meal choice: ' || "meal")
WHERE "meal" IS NOT NULL AND "meal" <> '';--> statement-breakpoint
ALTER TABLE "guests" DROP COLUMN "meal";--> statement-breakpoint
ALTER TABLE "settings" DROP COLUMN "meal_options";
