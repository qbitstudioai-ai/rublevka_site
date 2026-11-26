import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { localDay } from "@/content/stay-request";
import { bookingProvider, bookingRequest, validMapObject } from "./booking";
import { callback, guestMessage, operator, pageContext, resolveCards } from "./chat-contract";
import { acceptGuest, acknowledge, cleanupExpired, duplicateCallback, finishDispatch, limitRate, operate, readMessages, receive, requireDialog, retentionSeconds, session } from "./chat-store";
import { accommodations, envelope, knowledge, siteLink } from "./knowledge";
import { publishedSite } from "../cms/public";
import { ApiError, apiError, authorized, json, jsonBody, rawJson } from "./security";
import { publicSettings } from "./settings";

const sessionCookie = "rublevka_assistant_v1";
const cookiePath = "/api/assistant/v1/chat";

function requireKey(request: Request, key?: string) {
  if (!authorized(request, key)) throw new ApiError(401, "unauthorized");
}

function webhook() {
  const value = process.env.ASSISTANT_N8N_WEBHOOK_URL;
  const key = process.env.ASSISTANT_N8N_WEBHOOK_KEY;
  if (!value || !key || !process.env.ASSISTANT_N8N_CALLBACK_KEY || !process.env.DATABASE_URL) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hash) return null;
    if (url.protocol === "https:" || (process.env.NODE_ENV !== "production" &&
      url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) return { url, key };
  } catch { /* Invalid server configuration is reported as unavailable. */ }
  return null;
}

export function verifySignature(body: string, timestamp: string | null, signature: string | null, key?: string, now = Date.now()) {
  if (!key || !timestamp || !/^\d{10}$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300 ||
      !signature || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", key).update(timestamp + "." + body).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
async function signedInput(request: Request, key?: string) {
  const body = await rawJson(request);
  if (!verifySignature(body, request.headers.get("x-assistant-timestamp"), request.headers.get("x-assistant-signature"), key))
    throw new ApiError(401, "unauthorized");
  try { return JSON.parse(body) as unknown; }
  catch { throw new ApiError(400, "invalid_json"); }
}

export async function deliverWebhook(config: NonNullable<ReturnType<typeof webhook>>, event: NonNullable<Awaited<ReturnType<typeof acceptGuest>>>) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(config.url, {
        method: "POST", body: JSON.stringify(event), cache: "no-store", redirect: "error",
        signal: AbortSignal.timeout(2000),
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + config.key, "Idempotency-Key": event.id },
      });
      if (response.body) void response.body.cancel().catch(() => {});
      if (response.ok) return true;
      if (response.status < 500 && response.status !== 429) return false;
    } catch { /* One retry with the same message ID. */ }
  }
  return false;
}

async function chat(request: Request, operation: string | undefined) {
  if (request.headers.get("x-assistant-client") !== "browser" ||
      ["cross-site", "same-site"].includes(request.headers.get("sec-fetch-site") ?? ""))
    throw new ApiError(403, "invalid_origin");
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin && origin !== new URL(siteLink("/")).origin)
    throw new ApiError(403, "invalid_origin");

  const settings = await publicSettings();
  const config = webhook();
  const available = settings.enabled && Boolean(config);
  if (operation === "session" && request.method === "POST") {
    const input = z.strictObject({ reset: z.boolean().default(false), create: z.boolean().default(false) })
      .parse(await jsonBody(request, 512));
    const presentation = { available, greeting: settings.greeting, unavailable: settings.unavailable, contact: settings.contact };
    if (!available) return json({ ...presentation, active: false });
    const jar = await cookies();
    const previous = jar.get(sessionCookie)?.value;
    const token = previous && /^[A-Za-z0-9_-]{43}$/.test(previous) ? previous : undefined;
    if (!input.create && !input.reset) {
      const active = token ? await requireDialog(token).then(() => true, (error: unknown) => {
        if (error instanceof ApiError && error.status === 404) return false;
        throw error;
      }) : false;
      return json({ ...presentation, active });
    }
    await limitRate("session:global", 120);
    await cleanupExpired();
    const result = await session(token, input.reset);
    if (result.created) jar.set(sessionCookie, result.token, {
      httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production",
      maxAge: retentionSeconds(), path: cookiePath,
    });
    return json({ ...presentation, active: true });
  }
  if (operation !== "messages" && operation !== "ack") throw new ApiError(404, "not_found");
  if (!available || !config) throw new ApiError(503, "chat_unavailable");
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ApiError(401, "session_required");
  const dialogId = await requireDialog(token);
  await limitRate(operation + ":" + request.method + ":" + dialogId, request.method === "GET" || operation === "ack" ? 40 : 12);
  if (operation === "ack") {
    if (request.method !== "POST") throw new ApiError(405, "method_not_allowed");
    const { ids } = z.strictObject({ ids: z.array(z.uuid()).min(1).max(20) }).parse(await jsonBody(request, 2048));
    await acknowledge(token, ids);
    return json({ status: "accepted" });
  }
  if (request.method === "GET") return json(await readMessages(token));
  const input = guestMessage.parse(await jsonBody(request, 10000));
  const event = await acceptGuest(token, input, await pageContext(input.context));
  if (!event) return json({ status: "duplicate", id: input.id }, 202);
  const sent = await deliverWebhook(config, event);
  await finishDispatch(event, sent);
  return json({ status: sent ? "accepted" : "delivery_failed", id: input.id }, sent ? 202 : 503);
}

export async function assistantRequest(request: Request, parts: string[]) {
  const [resource, id] = parts;
  try {
    if (parts.length > 2) throw new ApiError(404, "not_found");
    if (resource === "chat") return await chat(request, id);
    if (resource === "callback" || resource === "operator") {
      if (request.method !== "POST") throw new ApiError(405, "method_not_allowed");
      if (process.env.ASSISTANT_CHAT_ENABLED !== "true" || !process.env.DATABASE_URL)
        throw new ApiError(503, "chat_unavailable");
      const operatorKey = process.env.ASSISTANT_OPERATOR_KEY;
      if (resource === "operator") {
        if (id) throw new ApiError(404, "not_found");
        return json(await operate(operator.parse(await signedInput(request, operatorKey))));
      }
      if (id !== "staff" && id !== undefined) throw new ApiError(404, "not_found");
      const source = id === "staff" ? "staff" : "assistant";
      const input = callback.parse(await signedInput(request, source === "staff" ? operatorKey : process.env.ASSISTANT_N8N_CALLBACK_KEY));
      if (input.source !== source) throw new ApiError(403, "wrong_source");
      if (await duplicateCallback(input)) return json({ status: "duplicate" });
      return json(await receive(input, input.status === "completed" ? await resolveCards(input.cards) : []));
    }
    requireKey(request, process.env.ASSISTANT_KNOWLEDGE_KEY);
    if (request.method === "GET") return json(await knowledge(resource, id, new URL(request.url).searchParams));
    if (id || (resource !== "availability" && resource !== "booking-link")) throw new ApiError(404, "not_found");
    const input = bookingRequest.parse(await jsonBody(request, 4096));
    if (input.arrival < localDay() || (input.objectId && !validMapObject(input.objectId, true))) throw new ApiError(400, "invalid_input");
    if (input.categoryId && !accommodations(await publishedSite()).some((item) => item.id === input.categoryId))
      throw new ApiError(400, "invalid_category");
    const result = await (resource === "availability" ? bookingProvider.availability(input) : bookingProvider.bookingLink(input));
    return json(envelope("booking-provider", { ...result, enquiryUrl: siteLink("/bronirovanie") }));
  } catch (error) {
    return apiError(error);
  }
}
