DROP INDEX "guests_one_plus_one_per_party";--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "plus_ones_allowed" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- Preserve existing permissions: a party that was allowed a plus one gets 1.
UPDATE "parties" SET "plus_ones_allowed" = 1 WHERE "plus_one_allowed" = true;--> statement-breakpoint
ALTER TABLE "parties" ADD CONSTRAINT "parties_plus_ones_allowed_range" CHECK ("plus_ones_allowed" >= 0 AND "plus_ones_allowed" <= 3);
