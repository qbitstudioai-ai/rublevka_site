import { bigint, bigserial, boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const assistantDialogs = pgTable("assistant_dialogs", {
  id: uuid().primaryKey().defaultRandom(),
  sessionHash: text("session_hash").notNull().unique(),
  owner: text().$type<"assistant" | "staff">().notNull().default("assistant"),
  version: integer().notNull().default(1),
  closed: boolean().notNull().default(false),
  consultation: text().notNull().default("none"),
  telegramTopic: text("telegram_topic"),
  salesStage: text("sales_stage"),
  need: jsonb().$type<Record<string, unknown>>(),
  summary: text(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [index("assistant_dialogs_expiry").on(table.expiresAt)]);

export type Card = { title: string; url: string; photo?: string };
export const assistantMessages = pgTable("assistant_messages", {
  sequence: bigserial({ mode: "number" }).primaryKey(),
  dialogId: uuid("dialog_id").notNull().references(() => assistantDialogs.id, { onDelete: "cascade" }),
  id: uuid().notNull(),
  source: text().$type<"guest" | "assistant" | "staff">().notNull(),
  requestId: uuid("request_id"),
  text: text().notNull(),
  cards: jsonb().$type<Card[]>().notNull().default([]),
  version: integer().notNull(),
  status: text().$type<"sending" | "pending" | "complete" | "failed" | "cancelled">().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
}, (table) => [index("assistant_messages_dialog_order").on(table.dialogId, table.sequence)]);

export const assistantReceipts = pgTable("assistant_receipts", {
  dialogId: uuid("dialog_id").notNull().references(() => assistantDialogs.id, { onDelete: "cascade" }),
  id: uuid().notNull(),
  kind: text().notNull(),
}, (table) => [primaryKey({ columns: [table.dialogId, table.id] })]);

export const assistantRates = pgTable("assistant_rates", {
  key: text().primaryKey(),
  bucket: bigint({ mode: "number" }).notNull(),
  count: integer().notNull(),
}, (table) => [index("assistant_rates_bucket").on(table.bucket)]);

export const assistantSettings = pgTable("assistant_settings", {
  id: integer().primaryKey(),
  enabled: boolean().notNull(),
  greeting: text(),
  unavailable: text().notNull(),
  phone: text(),
});
export const assistantSettingsAudit = pgTable("assistant_settings_audit", {
  id: bigserial({ mode: "number" }).primaryKey(),
  actorId: uuid("actor_id").notNull(),
  changes: jsonb().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
