import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const siteStaffRole = pgEnum("cms_site_staff_role", ["admin", "editor"]);

export const cmsSiteStaff = pgTable("cms_site_staff", {
  id: uuid().primaryKey().defaultRandom(),
  login: text().notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: siteStaffRole().notNull(),
  active: boolean().notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const cmsSiteSessions = pgTable(
  "cms_site_sessions",
  {
    id: uuid().primaryKey().defaultRandom(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => cmsSiteStaff.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("cms_site_sessions_staff_id_idx").on(table.staffId),
    index("cms_site_sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const cmsSiteLoginLimits = pgTable(
  "cms_site_login_limits",
  {
    key: text().primaryKey(),
    count: integer().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("cms_site_login_limits_expiry_idx").on(table.expiresAt)],
);

export const cmsSiteStaffAudit = pgTable(
  "cms_site_staff_audit",
  {
    id: uuid().primaryKey().defaultRandom(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => cmsSiteStaff.id),
    targetId: uuid("target_id")
      .notNull()
      .references(() => cmsSiteStaff.id),
    action: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("cms_site_staff_audit_created_at_idx").on(table.createdAt)],
);
