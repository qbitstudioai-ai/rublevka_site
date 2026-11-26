CREATE TABLE "cms_site_document_media_drafts" (
	"document_key" text PRIMARY KEY NOT NULL,
	"media_revision" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cms_site_document_media_revision_positive" CHECK ("cms_site_document_media_drafts"."media_revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "cms_site_document_media_drafts" ADD CONSTRAINT "cms_site_document_media_drafts_document_key_cms_site_documents_key_fk" FOREIGN KEY ("document_key") REFERENCES "public"."cms_site_documents"("key") ON DELETE cascade ON UPDATE no action;