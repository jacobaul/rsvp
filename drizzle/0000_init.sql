CREATE TYPE "public"."guest_kind" AS ENUM('named', 'plus_one');--> statement-breakpoint
CREATE TYPE "public"."rsvp_status" AS ENUM('pending', 'both', 'ceremony', 'reception', 'declined');--> statement-breakpoint
CREATE TABLE "activity_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "activity_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"party_id" integer,
	"type" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" "inet",
	"user_agent" text,
	"path" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "guests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "guests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"party_id" integer NOT NULL,
	"kind" "guest_kind" DEFAULT 'named' NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"rsvp_status" "rsvp_status" DEFAULT 'pending' NOT NULL,
	"meal" text,
	"dietary_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parties" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "parties_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"plus_one_allowed" boolean DEFAULT false NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"admin_notes" text,
	"guest_message" text,
	"responded_at" timestamp with time zone,
	"last_response_at" timestamp with time zone,
	"first_viewed_at" timestamp with time zone,
	"last_viewed_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"rsvp_open" boolean DEFAULT false NOT NULL,
	"rsvp_deadline" timestamp with time zone,
	"site_url" text DEFAULT '' NOT NULL,
	"meal_options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ceremony_label" text DEFAULT 'Ceremony' NOT NULL,
	"reception_label" text DEFAULT 'Reception' NOT NULL,
	"ceremony_enabled" boolean DEFAULT true NOT NULL,
	"reception_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests" ADD CONSTRAINT "guests_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_party_occurred_idx" ON "activity_events" USING btree ("party_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "activity_occurred_idx" ON "activity_events" USING btree ("occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "guests_party_id_idx" ON "guests" USING btree ("party_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guests_one_plus_one_per_party" ON "guests" USING btree ("party_id") WHERE "guests"."kind" = 'plus_one';--> statement-breakpoint
CREATE UNIQUE INDEX "parties_code_key" ON "parties" USING btree ("code");--> statement-breakpoint
CREATE INDEX "parties_tags_idx" ON "parties" USING gin ("tags");