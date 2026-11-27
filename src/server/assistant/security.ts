import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

export class ApiError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

export function authorized(request: Request, key?: string) {
  if (!key) return false;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from("Bearer " + key);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function rawJson(request: Request, limit = 16384) {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get("content-type") ?? ""))
    throw new ApiError(415, "json_required");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "invalid_json");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      void reader.cancel().catch(() => {});
      throw new ApiError(413, "body_too_large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function jsonBody(request: Request, limit?: number): Promise<unknown> {
  try { return JSON.parse(await rawJson(request, limit)); }
  catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(400, "invalid_json"); }
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function apiError(error: unknown) {
  if (error instanceof ApiError) return json({ error: error.code }, error.status);
  if (error instanceof z.ZodError) return json({ error: "invalid_input" }, 400);
  console.error("Assistant request failed");
  return json({ error: "temporarily_unavailable" }, 503);
}

const personalName = "[А-ЯЁA-Z][а-яёa-z]+(?:-[А-ЯЁA-Z][а-яёa-z]+)?";
const namedPerson = /(?:фио|меня зовут|имя и фамилия|full name)\s*:?\s*[\p{L}-]+(?:[ \t]+(?!(?:заезд|выезд|бюджет|стоимость|даты|цена)(?:\s|:|$))[\p{L}-]+){0,2}/giu;
const patronymic = new RegExp(String.raw`(?<![\p{L}])${personalName}[ \t]+${personalName}[ \t]+[А-ЯЁ][а-яё]+(?:ович|евич|овна|евна|инична|ична)(?![\p{L}])`, "gu");

export function redact(value: string) {
  return value.normalize("NFC")
    .replace(namedPerson, "[скрыто]")
    .replace(patronymic, "[скрыто]")
    .replace(/(?:адрес|address)\s*:\s*[^\n;]+?(?=,\s*(?:заезд|выезд|даты|бюджет|цена|стоимость)(?=\s|:)|;|\n|$)/giu, "[скрыто]")
    .replace(/(?:(?:г\.|город)\s*[\p{L} -]+,\s*)?(?:ул\.|улица|проспект|пр-т|переулок|шоссе|street)\s*[\p{L}\d -]+(?:,?\s*(?:д\.|дом|кв\.|квартира)\s*\d+[\p{L}/\d-]*)*/giu, "[скрыто]")
    .replace(/(?:паспорт|passport)\s*:\s*[\d \t-]{6,20}\d/giu, "[скрыто]")
    .replace(/[^\s@]+@[^\s@]+\.[\p{L}]{2,}/giu, "[скрыто]")
    .replace(/(?:https?:\/\/|www\.)[^\s]+/gi, "[скрыто]")
    .replace(/@[\p{L}\p{N}_]+/gu, "[скрыто]")
    .replace(/(?<![\p{L}\d])(?:\+?[78](?:[ \t().-]*\d){10}|\+(?![78])(?:[ \t().-]*\d){10,15}|\(\d{3}\)(?:[ \t.-]*\d){7}|9\d{2}[ \t-]\d{3}[ \t-]\d{2}[ \t-]\d{2})(?!\d)/gu,
      (match, offset: number, input: string) => /^(?:[ \t]*)(?:₽|руб|RUB|[€$])/iu.test(input.slice(offset + match.length))
        && /^\d{1,3}(?: \d{3})*$/.test(match) ? match : "[скрыто]");
}

export function canonicalJson(input: object) {
  return JSON.stringify(input, (_key, value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    return Object.fromEntries(Object.entries(value).sort(([first], [second]) => first < second ? -1 : first > second ? 1 : 0));
  });
}
