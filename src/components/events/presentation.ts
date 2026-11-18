import { mediaCatalog, type MediaId } from "@/content/media";
import { localDay, nextDay } from "@/content/stay-request";

const calendar = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Volgograd",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const clock = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Volgograd",
  hour: "2-digit",
  minute: "2-digit",
});
const currency = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
export function eventDate(start: Date, end: Date) {
  const first = calendar.format(start) + " · " + clock.format(start);
  if (start.getTime() === end.getTime()) return first;
  return (
    first +
    " — " +
    (localDay(start) === localDay(end)
      ? clock.format(end)
      : calendar.format(end) + " · " + clock.format(end))
  );
}
export function shortDate(date: Date) {
  return calendar.format(date);
}
export function money(value: number) {
  return currency.format(value / 100);
}
export function displayPrice(value: number | null) {
  return value === null
    ? "По запросу"
    : value === 0
      ? "Бесплатно"
      : money(value);
}
export function mediaId(value: string | null): MediaId | undefined {
  return value && Object.hasOwn(mediaCatalog, value)
    ? (value as MediaId)
    : undefined;
}
export function stayLink(start: Date, end: Date) {
  const arrival = localDay(start),
    lastDay = localDay(end);
  const departure = lastDay > arrival ? lastDay : nextDay(arrival)!;
  return "/bronirovanie?" + new URLSearchParams({ arrival, departure });
}
type PlanItem = {
  id?: string;
  title: string;
  startsAt: Date | null;
  price: number | null;
};
export function dayPlan(event: PlanItem, activities: PlanItem[]) {
  const entries = [event, ...activities].sort(
    (a, b) =>
      (a.startsAt?.getTime() ?? Infinity) - (b.startsAt?.getTime() ?? Infinity),
  );
  return {
    entries,
    total: entries.reduce((sum, entry) => sum + (entry.price ?? 0), 0),
    hasQuote: entries.some((entry) => entry.price === null),
  };
}
export function planTime(date: Date | null, day: Date) {
  if (!date) return "По согласованию";
  return localDay(date) === localDay(day)
    ? clock.format(date)
    : shortDate(date) + " · " + clock.format(date);
}
