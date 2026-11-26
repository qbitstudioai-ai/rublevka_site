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

export function redact(value: string) {
  return value.normalize("NFKC")
    .replace(/\b(?:passport|address|full name)\s*:\s*[^\n]+|(?:паспорт|адрес|фио)\s*:\s*[^\n]+/giu, "[скрыто]")
    .replace(/[^\s@]+@[^\s@]+\.[\p{L}]{2,}/giu, "[скрыто]")
    .replace(/(?:https?:\/\/|www\.)[^\s]+/gi, "[скрыто]")
    .replace(/@[\p{L}\p{N}_]+/gu, "[скрыто]")
    .replace(/\+?\d(?:[\s().-]*\d){5,}/g, "[скрыто]");
}
