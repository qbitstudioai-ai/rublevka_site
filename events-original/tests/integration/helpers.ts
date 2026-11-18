import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { openDatabase, runMigrations } from "@/db/migrator.mjs";
import { createActivity } from "@/lib/server/repo/activities";
import { createEvent } from "@/lib/server/repo/events";
import { activitySchema, eventSchema } from "@/lib/server/validation";

export function tempDir(prefix = "rublevka-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Новая мигрированная БД во временной папке. */
export function freshDb() {
  const dir = tempDir();
  const db = openDatabase(path.join(dir, "test.sqlite"));
  runMigrations(db);
  return { db, dir };
}

let counter = 0;

export function makeEvent(db: ReturnType<typeof freshDb>["db"], overrides: Partial<Record<string, string>> = {}, hero: string | null = null) {
  counter += 1;
  const input = eventSchema.parse({
    title: `Тестовое мероприятие ${counter}`,
    slug: `test-event-${counter}-${Date.now()}`,
    eventDate: "2026-11-01",
    startTime: "12:00",
    shortDescription: "",
    locationText: "",
    status: "published",
    ...overrides,
  });
  return { id: createEvent(db, input, hero), input };
}

export function activityInput(overrides: Partial<Record<string, string | boolean>> = {}) {
  return activitySchema.parse({
    title: "Услуга",
    shortDescription: "",
    longDescription: "",
    startTime: "",
    durationText: "",
    pricingType: "fixed",
    price: "3500",
    priceSuffix: "",
    details: "",
    isActive: true,
    ...overrides,
  });
}

export function makeActivity(
  db: ReturnType<typeof freshDb>["db"],
  eventId: number,
  overrides: Partial<Record<string, string | boolean>> = {},
  card: string | null = null,
  gallery: string[] = [],
) {
  return createActivity(db, eventId, activityInput(overrides), card, gallery);
}

/** Настоящее PNG-изображение для проверки загрузки. */
export async function pngFile(name = "photo.png", type = "image/png") {
  const buffer = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#3a7a42" } }).png().toBuffer();
  return new File([new Uint8Array(buffer)], name, { type });
}

export const uploadExists = (dir: string, ref: string | null) => !!ref && fs.existsSync(path.join(dir, ref.replace(/^upload:/, "")));
