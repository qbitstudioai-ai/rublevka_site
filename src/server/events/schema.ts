import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid().defaultRandom().primaryKey();
const instant = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

export const eventStatus = pgEnum("event_status", [
  "draft",
  "open",
  "closed",
  "full",
  "cancelled",
  "completed",
]);
export const registrationStatus = pgEnum("registration_status", [
  "pending",
  "confirmed",
  "cancelled",
  "attended",
]);
export const paymentStatus = pgEnum("payment_status", [
  "unpaid",
  "paid",
  "refunded",
]);
export const adminRole = pgEnum("admin_role", ["admin", "manager"]);

export const events = pgTable(
  "events",
  {
    id: id(),
    sourceSlug: text("source_slug").unique(),
    slug: text().unique().notNull(),
    title: text().notNull(),
    description: text().notNull().default(""),
    program: text().notNull().default(""),
    conditions: text().notNull().default(""),
    imageId: text("image_id").notNull().default("oak-forest"),
    startsAt: instant("starts_at").notNull(),
    endsAt: instant("ends_at").notNull(),
    status: eventStatus().notNull().default("draft"),
    archive: boolean().notNull().default(false),
    group: boolean().notNull().default(false),
    price: integer(),
    capacity: integer(),
    termsVerifiedAt: instant("terms_verified_at"),
    reviewNote: text("review_note").notNull().default(""),
  },
  (t) => [
    index("events_calendar").on(t.status, t.startsAt),
    check("event_dates", sql`${t.endsAt} >= ${t.startsAt}`),
    check("event_price", sql`${t.price} >= 0`),
    check("event_capacity", sql`${t.capacity} >= 0`),
  ],
);

export const activities = pgTable(
  "event_activities",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    title: text().notNull(),
    description: text().notNull().default(""),
    longDescription: text("long_description").notNull().default(""),
    details: text().notNull().default(""),
    durationText: text("duration_text").notNull().default(""),
    priceSuffix: text("price_suffix").notNull().default(""),
    galleryIds: text("gallery_ids")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    position: integer().notNull().default(0),
    imageId: text("image_id"),
    startsAt: instant("starts_at"),
    price: integer(),
    capacity: integer(),
    available: boolean().notNull().default(true),
    required: boolean().notNull().default(false),
  },
  (t) => [
    index("activities_event").on(t.eventId),
    check("activity_position", sql`${t.position} >= 0`),
    check("activity_price", sql`${t.price} >= 0`),
    check("activity_capacity", sql`${t.capacity} >= 0`),
  ],
);

export const registrations = pgTable(
  "event_registrations",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    requestId: uuid("request_id").notNull(),
    name: text().notNull(),
    phone: text().notNull(),
    messenger: text(),
    groupSize: integer("group_size").notNull().default(1),
    eventPrice: integer("event_price"),
    consentedAt: instant("consented_at").notNull().defaultNow(),
    consentVersion: text("consent_version").notNull(),
    total: bigint({ mode: "number" }).notNull(),
    hasQuote: boolean("has_quote").notNull(),
    status: registrationStatus().notNull().default("pending"),
    paymentStatus: paymentStatus("payment_status").notNull().default("unpaid"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("registration_request").on(t.eventId, t.requestId),
    index("registrations_event_status").on(t.eventId, t.status),
    check("registration_group_size", sql`${t.groupSize} between 1 and 1000000`),
    check("saved_event_price", sql`${t.eventPrice} >= 0`),
    check("registration_total", sql`${t.total} >= 0`),
  ],
);

export const registrationActivities = pgTable(
  "registration_activities",
  {
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => registrations.id),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id),
    title: text().notNull(),
    price: integer(),
    priceSuffix: text("price_suffix").notNull().default(""),
    startsAt: instant("starts_at"),
    position: integer().notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.registrationId, t.activityId] }),
    index("registrations_per_activity").on(t.activityId),
    check("saved_activity_price", sql`${t.price} >= 0`),
  ],
);

export const adminUsers = pgTable("admin_users", {
  id: id(),
  login: text().unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  role: adminRole().notNull(),
  active: boolean().notNull().default(true),
});
export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: id(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => adminUsers.id),
    expiresAt: instant("expires_at").notNull(),
  },
  (t) => [index("session_expiry").on(t.expiresAt)],
);
export const auditLogs = pgTable("audit_log", {
  id: id(),
  adminId: uuid("admin_id")
    .notNull()
    .references(() => adminUsers.id),
  action: text().notNull(),
  targetId: uuid("target_id").notNull(),
  createdAt: instant("created_at").notNull().defaultNow(),
});
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text().primaryKey(),
    count: integer().notNull(),
    expiresAt: instant("expires_at").notNull(),
  },
  (t) => [index("rate_expiry").on(t.expiresAt)],
);
