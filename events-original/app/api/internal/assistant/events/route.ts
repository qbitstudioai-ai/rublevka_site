import { timingSafeEqual } from "node:crypto";
import { ZodError } from "zod";
import { assistantEvents, assistantEventQuery } from "../../../../../lib/server/assistant-events";
import { getDb } from "../../../../../lib/server/db";

function reply(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function GET(request: Request) {
  const key = process.env.ASSISTANT_EVENTS_KEY;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from("Bearer " + (key ?? ""));
  if (!key || actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return reply({ error: "unauthorized" }, 401);
  try {
    const params = new URL(request.url).searchParams;
    const { id } = assistantEventQuery.parse(Object.fromEntries(params));
    return reply(assistantEvents(getDb(), id ?? null, params));
  } catch (error) {
    if (error instanceof ZodError) return reply({ error: "invalid_input" }, 400);
    console.error("Assistant SQLite read failed");
    return reply({ error: "temporarily_unavailable" }, 503);
  }
}
