ALTER TABLE "events" ADD COLUMN "source_slug" text;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_source_slug_unique" UNIQUE("source_slug");