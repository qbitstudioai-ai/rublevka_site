CREATE TABLE "assistant_consultations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dialog_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"question" text NOT NULL,
	"result" text,
	"status" text DEFAULT 'requested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD COLUMN "webhook" jsonb;--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD COLUMN "dispatch_lease" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD COLUMN "dispatch_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "assistant_receipts" ADD COLUMN "fingerprint" text;--> statement-breakpoint
ALTER TABLE "assistant_consultations" ADD CONSTRAINT "assistant_consultations_dialog_id_assistant_dialogs_id_fk" FOREIGN KEY ("dialog_id") REFERENCES "public"."assistant_dialogs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistant_consultations_dialog" ON "assistant_consultations" USING btree ("dialog_id","created_at");--> statement-breakpoint
UPDATE "assistant_dialogs" SET "telegram_topic" = NULL
WHERE "telegram_topic" IN (
  SELECT "telegram_topic" FROM "assistant_dialogs" WHERE "telegram_topic" IS NOT NULL
  GROUP BY "telegram_topic" HAVING count(*) > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX "assistant_dialogs_topic" ON "assistant_dialogs" USING btree ("telegram_topic");--> statement-breakpoint
ALTER TABLE "assistant_dialogs" DROP COLUMN "consultation";