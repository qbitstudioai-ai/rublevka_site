CREATE TYPE "public"."cms_site_content_state" AS ENUM('draft', 'review', 'published');--> statement-breakpoint
CREATE TYPE "public"."cms_site_staff_role" AS ENUM('admin', 'editor');--> statement-breakpoint
CREATE TABLE "cms_site_content_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"document_key" text NOT NULL,
	"action" text NOT NULL,
	"revision" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_site_documents" (
	"key" text PRIMARY KEY NOT NULL,
	"draft" jsonb NOT NULL,
	"published" jsonb NOT NULL,
	"previous" jsonb,
	"state" "cms_site_content_state" DEFAULT 'published' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"previous_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cms_site_document_revision_positive" CHECK ("cms_site_documents"."revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "cms_site_login_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_site_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_site_staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"login" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "cms_site_staff_role" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cms_site_staff_login_unique" UNIQUE("login")
);
--> statement-breakpoint
CREATE TABLE "cms_site_staff_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cms_site_content_audit" ADD CONSTRAINT "cms_site_content_audit_actor_id_cms_site_staff_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."cms_site_staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_site_content_audit" ADD CONSTRAINT "cms_site_content_audit_document_key_cms_site_documents_key_fk" FOREIGN KEY ("document_key") REFERENCES "public"."cms_site_documents"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_site_sessions" ADD CONSTRAINT "cms_site_sessions_staff_id_cms_site_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."cms_site_staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_site_staff_audit" ADD CONSTRAINT "cms_site_staff_audit_actor_id_cms_site_staff_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."cms_site_staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_site_staff_audit" ADD CONSTRAINT "cms_site_staff_audit_target_id_cms_site_staff_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."cms_site_staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cms_site_content_audit_document_time" ON "cms_site_content_audit" USING btree ("document_key","created_at");--> statement-breakpoint
CREATE INDEX "cms_site_login_limits_expiry_idx" ON "cms_site_login_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "cms_site_sessions_staff_id_idx" ON "cms_site_sessions" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "cms_site_sessions_expires_at_idx" ON "cms_site_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "cms_site_staff_audit_created_at_idx" ON "cms_site_staff_audit" USING btree ("created_at");