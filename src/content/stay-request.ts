export const roomLabels = {
  room: "Номер в срубе",
  cottage: "Отдельный коттедж",
  bedrooms: "Дом с двумя спальнями",
  family: "Семейный дом",
} as const;
export type Room = keyof typeof roomLabels;
export const initialStay = {
  arrival: "",
  departure: "",
  adults: "2",
  children: "0",
  room: "",
};
export type Stay = typeof initialStay;
export const fields = Object.keys(initialStay) as (keyof Stay)[];
export function readStay(
  params: URLSearchParams,
  defaults: Stay = initialStay,
): Stay {
  const result = { ...defaults };
  for (const key of fields) result[key] = params.get(key) ?? defaults[key];
  return result;
}
export function stayParams(stay: Stay) {
  return new URLSearchParams(
    fields.filter((k) => stay[k] !== "").map((k) => [k, stay[k]]),
  );
}
export function localDay(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Volgograd",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
function dayNumber(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NaN;
  const ms = Date.parse(date + "T00:00:00Z");
  return Number.isFinite(ms) &&
    new Date(ms).toISOString().startsWith(date + "T")
    ? ms / 86400000
    : NaN;
}
export function nights(s: Stay) {
  return dayNumber(s.departure) - dayNumber(s.arrival);
}
export function nextDay(date: string) {
  const n = dayNumber(date);
  return Number.isFinite(n)
    ? new Date((n + 1) * 86400000).toISOString().slice(0, 10)
    : undefined;
}
export function validate(
  s: Stay,
  today: string,
): Partial<Record<keyof Stay, string>> {
  const errors: Partial<Record<keyof Stay, string>> = {};
  if (!Number.isFinite(dayNumber(s.arrival)) || s.arrival < today)
    errors.arrival = "Выберите заезд сегодня или позднее.";
  if (
    !Number.isFinite(dayNumber(s.departure)) ||
    s.departure <= s.arrival ||
    s.departure <= today
  )
    errors.departure = "Выберите выезд позже даты заезда.";
  for (const k of ["adults", "children"] as const)
    if (
      !/^\d+$/.test(s[k]) ||
      !Number.isSafeInteger(Number(s[k])) ||
      Number(s[k]) < (k === "adults" ? 1 : 0)
    )
      errors[k] =
        k === "adults"
          ? "Укажите хотя бы одного взрослого."
          : "Укажите целое число детей от нуля.";
  if (s.room && !Object.hasOwn(roomLabels, s.room))
    errors.room = "Выберите тип размещения из списка.";
  return errors;
}
export function requestText(s: Stay) {
  const date = (d: string) => d.split("-").reverse().join(".");
  return [
    `Заезд: ${date(s.arrival)} · Выезд: ${date(s.departure)}`,
    `Ночей: ${nights(s)}`,
    `Взрослых: ${s.adults} · Детей: ${s.children}`,
    `Размещение: ${roomLabels[s.room as Room] ?? "Любой вариант"}`,
  ].join("\n");
}
