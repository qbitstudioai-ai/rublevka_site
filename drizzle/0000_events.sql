CREATE TYPE "public"."admin_role" AS ENUM('admin', 'manager');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('draft', 'open', 'closed', 'full', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('unpaid', 'paid', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."registration_status" AS ENUM('pending', 'confirmed', 'cancelled', 'attended');--> statement-breakpoint
CREATE TABLE "event_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"image_id" text,
	"starts_at" timestamp with time zone,
	"price" integer,
	"capacity" integer,
	"available" boolean DEFAULT true NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	CONSTRAINT "activity_price" CHECK ("event_activities"."price" >= 0),
	CONSTRAINT "activity_capacity" CHECK ("event_activities"."capacity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"login" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "admin_role" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "admin_users_login_unique" UNIQUE("login")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"action" text NOT NULL,
	"target_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"program" text DEFAULT '' NOT NULL,
	"conditions" text DEFAULT '' NOT NULL,
	"image_id" text DEFAULT 'oak-forest' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"archive" boolean DEFAULT false NOT NULL,
	"group" boolean DEFAULT false NOT NULL,
	"price" integer,
	"capacity" integer,
	"review_note" text DEFAULT '' NOT NULL,
	CONSTRAINT "events_slug_unique" UNIQUE("slug"),
	CONSTRAINT "event_dates" CHECK ("events"."ends_at" >= "events"."starts_at"),
	CONSTRAINT "event_price" CHECK ("events"."price" >= 0),
	CONSTRAINT "event_capacity" CHECK ("events"."capacity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registration_activities" (
	"registration_id" uuid NOT NULL,
	"activity_id" uuid NOT NULL,
	"title" text NOT NULL,
	"price" integer,
	CONSTRAINT "registration_activities_registration_id_activity_id_pk" PRIMARY KEY("registration_id","activity_id"),
	CONSTRAINT "saved_activity_price" CHECK ("registration_activities"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "event_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"messenger" text,
	"consented_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consent_version" text NOT NULL,
	"total" bigint NOT NULL,
	"has_quote" boolean NOT NULL,
	"status" "registration_status" DEFAULT 'pending' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'unpaid' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registration_total" CHECK ("event_registrations"."total" >= 0)
);
--> statement-breakpoint
ALTER TABLE "event_activities" ADD CONSTRAINT "event_activities_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_admin_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_admin_id_admin_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_activities" ADD CONSTRAINT "registration_activities_registration_id_event_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."event_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_activities" ADD CONSTRAINT "registration_activities_activity_id_event_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."event_activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_event" ON "event_activities" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "session_expiry" ON "admin_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "events_calendar" ON "events" USING btree ("status","starts_at");--> statement-breakpoint
CREATE INDEX "rate_expiry" ON "rate_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "registrations_per_activity" ON "registration_activities" USING btree ("activity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "registration_request" ON "event_registrations" USING btree ("event_id","request_id");--> statement-breakpoint
CREATE INDEX "registrations_event_status" ON "event_registrations" USING btree ("event_id","status");