CREATE TABLE "assistant_dialogs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_hash" text NOT NULL,
	"owner" text DEFAULT 'assistant' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"closed" boolean DEFAULT false NOT NULL,
	"consultation" text DEFAULT 'none' NOT NULL,
	"telegram_topic" text,
	"sales_stage" text,
	"need" jsonb,
	"summary" text,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "assistant_dialogs_session_hash_unique" UNIQUE("session_hash")
);
--> statement-breakpoint
CREATE TABLE "assistant_messages" (
	"sequence" bigserial PRIMARY KEY NOT NULL,
	"dialog_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"source" text NOT NULL,
	"request_id" uuid,
	"text" text NOT NULL,
	"cards" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "assistant_rates" (
	"key" text PRIMARY KEY NOT NULL,
	"bucket" bigint NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_receipts" (
	"dialog_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"kind" text NOT NULL,
	CONSTRAINT "assistant_receipts_dialog_id_id_pk" PRIMARY KEY("dialog_id","id")
);
--> statement-breakpoint
CREATE TABLE "assistant_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"enabled" boolean NOT NULL,
	"greeting" text,
	"unavailable" text NOT NULL,
	"phone" text
);
--> statement-breakpoint
CREATE TABLE "assistant_settings_audit" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" uuid NOT NULL,
	"changes" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_dialog_id_assistant_dialogs_id_fk" FOREIGN KEY ("dialog_id") REFERENCES "public"."assistant_dialogs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_receipts" ADD CONSTRAINT "assistant_receipts_dialog_id_assistant_dialogs_id_fk" FOREIGN KEY ("dialog_id") REFERENCES "public"."assistant_dialogs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistant_dialogs_expiry" ON "assistant_dialogs" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "assistant_messages_dialog_order" ON "assistant_messages" USING btree ("dialog_id","sequence");--> statement-breakpoint
CREATE INDEX "assistant_rates_bucket" ON "assistant_rates" USING btree ("bucket");