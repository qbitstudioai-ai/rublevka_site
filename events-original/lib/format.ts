import { APP_TIME_ZONE } from "./shared/format-core.mjs";

export { APP_TIME_ZONE, formatEventDate, formatEventSchedule } from "./shared/format-core.mjs";

/** ISO-время создания записи → «16.10.2026, 14:05» по времени комплекса. */
export function formatDateTime(isoDateTime: string) {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return isoDateTime;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  }).format(date);
}

/** Сегодняшняя дата по времени комплекса в формате YYYY-MM-DD. */
export function todayIso(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: APP_TIME_ZONE }).format(now);
}

/**
 * Мероприятие прошло: его дата раньше сегодняшней по времени комплекса.
 * В день мероприятия регистрация ещё открыта — так же, как оно ещё есть в списке на главной.
 */
export function isPastEvent(eventDate: string, today = todayIso()) {
  return eventDate < today;
}

/** «2026-10-24» → «2026-10-25». */
export function nextIsoDate(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** «2026-10-24» → { day: "24", month: "октября", weekday: "суббота" } для «листка календаря». */
export function eventDateParts(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return { day: isoDate, month: "", weekday: "" };
  const parts = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" }).formatToParts(date);
  return {
    day: parts.find((part) => part.type === "day")?.value ?? "",
    month: parts.find((part) => part.type === "month")?.value ?? "",
    weekday: new Intl.DateTimeFormat("ru-RU", { weekday: "long", timeZone: "UTC" }).format(date),
  };
}
