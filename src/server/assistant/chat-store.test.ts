import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../events/db";
import { acceptGuest, acknowledge, finishDispatch, operate, readMessages, receive, session } from "./chat-store";
import { assistantRequest, deliverWebhook } from "./http";
import { ApiError } from "./security";

before(async () => {
  const target = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(target.hostname, "127.0.0.1");
  assert.equal(target.pathname, "/rublevka_events_test");
  await migrate(db, { migrationsFolder: "drizzle" });
});
after(() => pool.end());

const context = { route: "/", type: "home", id: null, stay: null };
const guest = () => ({ id: randomUUID(), text: "мой email a@example.com", context: { path: "/" } });
const action = (dialogId: string, version: number, action: "takeover" | "release") =>
  ({ dialogId, version, id: randomUUID(), action });

test("isolates sessions, deduplicates messages and blocks undelivered responses on takeover", async () => {
  const first = await session(undefined, false);
  const second = await session(undefined, false);
  assert.deepEqual(await session(first.token, false), { token: first.token, created: false });
  const input = guest();
  const received = await Promise.all([acceptGuest(first.token, input, context), acceptGuest(first.token, input, context)]);
  const event = received.find((value) => value !== null);
  assert.equal(received.filter(Boolean).length, 1);
  assert.ok(event);
  assert.equal(event.text, "мой email [скрыто]");
  assert.equal((await readMessages(second.token)).messages.length, 0);
  await finishDispatch(event, true);
  const reply = { dialogId: event.dialogId, id: randomUUID(), requestId: input.id,
    version: 1, source: "assistant" as const, status: "completed" as const, text: "До перехвата", cards: [] };
  assert.deepEqual(await receive(reply, []), { status: "accepted" });
  assert.deepEqual(await receive(reply, []), { status: "duplicate" });
  const takeover = action(event.dialogId, 1, "takeover");
  assert.equal((await operate(takeover)).owner, "staff");
  assert.equal((await operate(takeover)).status, "duplicate");
  await assert.rejects(receive({ ...reply, id: randomUUID() }, []), (error) =>
    error instanceof ApiError && error.code === "stale_state");
  assert.equal((await readMessages(first.token)).messages.some(({ source }) => source === "assistant"), false);
  await receive({ ...reply, id: randomUUID(), source: "staff", version: 2, requestId: null, text: "На связи" }, []);
  const delivery = await readMessages(first.token);
  assert.equal(delivery.messages.at(-1)?.text, "На связи");
  assert.deepEqual((await readMessages(first.token)).acknowledge, delivery.acknowledge);
  await acknowledge(first.token, delivery.acknowledge);
  assert.deepEqual((await readMessages(first.token)).acknowledge, []);
  assert.equal((await operate(action(event.dialogId, 2, "release"))).version, 3);
  const reset = await session(first.token, true);
  assert.equal((await readMessages(reset.token)).messages.length, 0);
  await assert.rejects(readMessages(first.token));
});

test("callbacks require signatures and reject expired signatures", async () => {
  process.env.ASSISTANT_CHAT_ENABLED = "true";
  process.env.ASSISTANT_N8N_CALLBACK_KEY = "test-key";
  const access = await session(undefined, false);
  const event = await acceptGuest(access.token, guest(), context);
  assert.ok(event);
  const body = JSON.stringify({ dialogId: event.dialogId, id: randomUUID(), requestId: event.id,
    version: 1, source: "assistant", status: "completed", text: "Ответ", cards: [] });
  async function call(age: number, signed: boolean) {
    const timestamp = String(Math.floor(Date.now() / 1000) - age);
    const signature = createHmac("sha256", signed ? "test-key" : "wrong").update(timestamp + "." + body).digest("hex");
    return assistantRequest(new Request("http://localhost/api/assistant/v1/callback", {
      method: "POST", body, headers: { "Content-Type": "application/json",
        "X-Assistant-Timestamp": timestamp, "X-Assistant-Signature": signature },
    }), ["callback"]);
  }
  try {
    assert.equal((await call(0, false)).status, 401);
    assert.equal((await call(301, true)).status, 401);
    assert.equal((await call(0, true)).status, 200);
    assert.deepEqual(await (await call(0, true)).json(), { status: "duplicate" });
  } finally {
    delete process.env.ASSISTANT_CHAT_ENABLED;
    delete process.env.ASSISTANT_N8N_CALLBACK_KEY;
  }
});

test("webhook retry uses the same message ID and a failure remains visible to the guest", async (t) => {
  const access = await session(undefined, false);
  const event = await acceptGuest(access.token, guest(), context);
  assert.ok(event);
  const fetch = t.mock.method(globalThis, "fetch", async (_url: string | URL | Request, init: RequestInit) => {
    assert.equal(new Headers(init.headers).get("idempotency-key"), event.id);
    return new Response(null, { status: 503 });
  });
  const sent = await deliverWebhook({ url: new URL("http://127.0.0.1"), key: "test" }, event);
  assert.equal(sent, false);
  assert.equal(fetch.mock.callCount(), 2);
  await finishDispatch(event, sent);
  assert.equal((await readMessages(access.token)).messages[0].status, "failed");
});
