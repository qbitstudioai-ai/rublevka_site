import { createHash } from "node:crypto";
import { mediaCatalog } from "@/content/media";

export class InputError extends Error {}
export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function revision(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function textValue(form: FormData, key: string, max = 5000) {
  const value = form.get(key);
  if (typeof value !== "string" || value.trim().length > max)
    throw new InputError("Проверьте текстовые поля.");
  return value.trim();
}
export function choice<T extends string>(
  form: FormData,
  key: string,
  options: readonly T[],
): T {
  const value = textValue(form, key);
  const selected = options.find((option) => option === value);
  if (!selected) throw new InputError("Выберите значение из списка.");
  return selected;
}
export function imageValue(form: FormData) {
  const image = textValue(form, "imageId", 100);
  if (image && !Object.hasOwn(mediaCatalog, image))
    throw new InputError("Выберите фотографию из каталога.");
  return image || null;
}
export function amount(form: FormData, key: string) {
  const input = textValue(form, key);
  if (!input) return null;
  if (!/^\d{1,7}([.,]\d{1,2})?$/.test(input))
    throw new InputError("Укажите цену в рублях с точностью до копеек.");
  const [rub, kop = ""] = input.replace(",", ".").split(".");
  return Number(rub) * 100 + Number(kop.padEnd(2, "0"));
}
export function capacityValue(form: FormData) {
  const input = textValue(form, "capacity");
  if (!input) return null;
  if (!/^[1-9]\d{0,6}$/.test(input))
    throw new InputError("Число мест должно быть положительным целым.");
  return Number(input);
}
export function dateValue(form: FormData, key: string) {
  const input = textValue(form, key);
  if (!input) return null;
  // All editor date/time fields use civil time in Volgograd (UTC+03:00).
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(input))
    throw new InputError("Проверьте дату и время.");
  const date = new Date(input + ":00+03:00");
  if (!Number.isFinite(date.valueOf()) || formatInputDate(date) !== input)
    throw new InputError("Проверьте дату и время.");
  return date;
}
export function formatInputDate(value: Date | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Volgograd",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(value)
    .replace(" ", "T");
}
export function csvCell(value: unknown) {
  const text = String(value ?? "");
  const safe = /^[\u0000-\u0020]*[=+@-]|^[\t\r\n]/.test(text)
    ? "'" + text
    : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}
