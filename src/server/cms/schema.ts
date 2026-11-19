import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { cmsSiteStaff } from "./auth-schema";
import type { SiteData, SiteKey } from "./model";

const instant = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });
export const cmsSiteState = pgEnum("cms_site_content_state", [
  "draft",
  "review",
  "published",
]);

export const cmsSiteDocuments = pgTable(
  "cms_site_documents",
  {
    key: text().$type<SiteKey>().primaryKey(),
    draft: jsonb().$type<SiteData[SiteKey]>().notNull(),
    published: jsonb().$type<SiteData[SiteKey]>().notNull(),
    previous: jsonb().$type<SiteData[SiteKey]>(),
    state: cmsSiteState().notNull().default("published"),
    revision: integer().notNull().default(1),
    publishedAt: instant("published_at").notNull().defaultNow(),
    previousAt: instant("previous_at"),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  (table) => [
    check("cms_site_document_revision_positive", sql`${table.revision} > 0`),
  ],
);

export const cmsSiteContentAudit = pgTable(
  "cms_site_content_audit",
  {
    id: uuid().primaryKey().defaultRandom(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => cmsSiteStaff.id),
    documentKey: text("document_key")
      .$type<SiteKey>()
      .notNull()
      .references(() => cmsSiteDocuments.key),
    action: text().$type<"save" | "submit" | "publish" | "restore">().notNull(),
    revision: integer().notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("cms_site_content_audit_document_time").on(
      table.documentKey,
      table.createdAt,
    ),
  ],
);
