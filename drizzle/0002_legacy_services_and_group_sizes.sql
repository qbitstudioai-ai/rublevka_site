ALTER TABLE "event_activities" ADD COLUMN "long_description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_activities" ADD COLUMN "details" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_activities" ADD COLUMN "duration_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_activities" ADD COLUMN "price_suffix" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_activities" ADD COLUMN "gallery_ids" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "event_activities" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "terms_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "registration_activities" ADD COLUMN "price_suffix" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "registration_activities" ADD COLUMN "starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "registration_activities" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "group_size" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "event_price" integer;--> statement-breakpoint
ALTER TABLE "event_activities" ADD CONSTRAINT "activity_position" CHECK ("event_activities"."position" >= 0);--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "registration_group_size" CHECK ("event_registrations"."group_size" between 1 and 1000000);--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "saved_event_price" CHECK ("event_registrations"."event_price" >= 0);