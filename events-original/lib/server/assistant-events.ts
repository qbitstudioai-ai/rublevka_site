import type Database from "better-sqlite3";
import { z } from "zod";
import { APP_TIME_ZONE, todayIso } from "../format";
import { getPublicActivities, toEventView } from "./public-data";
import { getEventById, getPublishedEventBySlug, type EventRow } from "./repo/events";

export const assistantEventQuery = z.strictObject({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  from: z.iso.date().optional(), to: z.iso.date().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
}).refine(({ from, to }) => !from || !to || from <= to);

function eventPath(slug: string) { return "/meropriyatiya/event/" + encodeURIComponent(slug); }
function summary(row: EventRow) {
  const view = toEventView(row);
  return {
    id: row.id, slug: row.slug, title: view.title, startsOn: row.event_date, startsAt: row.start_time,
    endsOn: row.end_date ?? row.event_date, endsAt: row.end_time, timeZone: APP_TIME_ZONE,
    description: view.description, priceKopecks: row.price_kopecks ?? 0, currency: "RUB",
    status: "published" as const, photo: view.heroImage?.src ?? null, url: eventPath(row.slug),
  };
}

function current(row: EventRow, today: string, time: string) {
  const end = row.end_date ?? row.event_date;
  return end > today || (end === today && (!row.end_time || row.end_time > time));
}

export function assistantEvents(db: Database.Database, id: string | null, params: URLSearchParams, now = new Date()) {
  const filter = assistantEventQuery.parse(Object.fromEntries(params));
  const today = todayIso(now);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIME_ZONE, timeStyle: "short" }).format(now);
  if (id) {
    const row = /^\d{1,15}$/.test(id) ? getEventById(db, Number(id)) : getPublishedEventBySlug(db, id);
    if (!row || row.status !== "published") return { item: null, total: 0 };
    const view = toEventView(row);
    return { total: 1, item: {
      ...summary(row), active: current(row, today, time), longDescription: view.longDescription || null, location: view.locationLabel || null,
      schedule: view.scheduleFacts, extraInfo: view.extraInfo || null,
      activities: getPublicActivities(db, row.id),
      registrationUrl: current(row, today, time) && row.event_date >= today ? eventPath(row.slug) : null,
    } };
  }
  const rows = db.prepare(`
    SELECT * FROM events
    WHERE status = 'published'
      AND COALESCE(end_date, event_date) >= ?
      AND (? IS NULL OR event_date <= ?)
    ORDER BY event_date, start_time, id
  `).all(filter.from && filter.from > today ? filter.from : today, filter.to ?? null, filter.to ?? null) as EventRow[];
  const q = filter.q?.toLocaleLowerCase("ru");
  const items = rows.filter((row) => current(row, today, time) &&
    (!q || [row.title, row.short_description, row.long_description].some((value) => value.toLocaleLowerCase("ru").includes(q))));
  return { items: items.slice(filter.offset, filter.offset + filter.limit).map(summary),
    total: items.length, limit: filter.limit, offset: filter.offset };
}
