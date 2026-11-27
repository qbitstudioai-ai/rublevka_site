import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../events/db";
import { acceptGuest, acknowledge, answerConsultation, deliverConsultation, finishDispatch, linkTelegramTopic, operate, patchDialogMemory, readDialog, readMessages, receive, session } from "./chat-store";
import { assistantRequest, deliverWebhook } from "./http";
import { ApiError } from "./security";
import { assistantConsultations, assistantDialogs, assistantMessages } from "./schema";
import { saveSettings } from "./settings";

const settingsActor = randomUUID();
const settings = (enabled: boolean) => saveSettings(settingsActor, { enabled, greeting: "", unavailable: "Недоступен", phone: "" });

before(async () => {
  const target = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(target.hostname, "127.0.0.1");
  assert.equal(target.pathname, "/rublevka_events_test");
  await migrate(db, { migrationsFolder: "drizzle" });
  process.env.ASSISTANT_CHAT_ENABLED = "true";
  await settings(true);
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

const errorCode = (code: string) => (error: unknown) => error instanceof ApiError && error.code === code;
const replyFor = (event: { dialogId: string; id: string; dialog: { version: number } }) => ({
  dialogId: event.dialogId, id: randomUUID(), requestId: event.id, version: event.dialog.version,
  source: "assistant" as const, status: "completed" as const, text: "Уточню эту информацию.", cards: [],
});
async function open() {
  const access = await session(undefined, false);
  const input = guest();
  const event = await acceptGuest(access.token, input, context);
  assert.ok(event);
  return { access, input, event };
}
async function consult() {
  const fixture = await open();
  const reply = { ...replyFor(fixture.event), consultation: { id: randomUUID(), question: "Доступен ли тихий дом?" } };
  await receive(reply, []);
  return { ...fixture, reply, consultationId: reply.consultation.id };
}
function signedCall(parts: string[], input: object, key: string) {
  const body = JSON.stringify(input);
  const timestamp = String(Math.floor(Date.now() / 1000));
  return assistantRequest(new Request("http://localhost/api/assistant/v1/" + parts.join("/"), {
    method: "POST", body, headers: { "Content-Type": "application/json", "X-Assistant-Timestamp": timestamp,
      "X-Assistant-Signature": createHmac("sha256", key).update(timestamp + "." + body).digest("hex") },
  }), parts);
}

test("consultation outlives the ordinary timeout and guest messages continue", async () => {
  const { access, event, consultationId } = await consult();
  await db.update(assistantMessages).set({ createdAt: new Date(Date.now() - 180_000) }).where(and(
    eq(assistantMessages.dialogId, event.dialogId), eq(assistantMessages.id, event.id)));
  const next = await acceptGuest(access.token, guest(), context);
  assert.ok(next);
  const command = { dialogId: event.dialogId, version: 1, consultationId };
  await answerConsultation({ ...command, id: randomUUID(), result: "Мои контакты: a@example.com. Дом доступен." });
  const state = await readDialog(event.dialogId);
  assert.equal(state.consultations[0].result, "Мои контакты: [скрыто]. Дом доступен.");
  assert.equal(state.history.some(({ text }) => text.includes("Дом доступен.")), false);
  const delivery = { ...command, id: randomUUID(), text: "Сотрудник подтвердил информацию.", cards: [] };
  assert.equal((await deliverConsultation(delivery, [])).status, "accepted");
  assert.equal((await deliverConsultation(delivery, [])).status, "duplicate");
  assert.equal((await readMessages(access.token)).messages.at(-1)?.text, delivery.text);
  assert.equal((await readDialog(event.dialogId)).consultations[0].result, null);
});

test("callback persists memory atomically and content changes conflict for every reused ID", async () => {
  const { access, input, event } = await open();
  await assert.rejects(acceptGuest(access.token, { ...input, text: "другой текст" }, context), errorCode("id_conflict"));
  const invalid = { ...replyFor(event), memory: { salesStage: "offer", need: { children: 1, childAges: [2, 6] } } };
  await assert.rejects(receive(invalid, []));
  assert.equal((await readDialog(event.dialogId)).salesStage, null);
  assert.equal((await readMessages(access.token)).messages.length, 1);
  const reply = { ...invalid, memory: { salesStage: "offer", summary: "ФИО: Иванов Иван Иванович",
    need: { children: 1, childAges: [6], dates: { arrival: "2099-01-02" }, budget: { amountMinor: 2500000 } } } };
  await receive(reply, []);
  await assert.rejects(receive({ ...reply, text: "изменено" }, []), errorCode("id_conflict"));
  await patchDialogMemory({ dialogId: event.dialogId, version: 1, id: randomUUID(),
    memory: { need: { dates: { departure: "2099-01-03" }, budget: { type: "total" } } } });
  assert.deepEqual((await readDialog(event.dialogId)).need, {
    dates: { arrival: "2099-01-02", departure: "2099-01-03" }, children: 1, childAges: [6],
    budget: { amountMinor: 2500000, type: "total" },
  });
  assert.equal((await readDialog(event.dialogId)).summary, "[скрыто]");
});

test("Telegram topic binding is one-to-one under concurrency", async () => {
  const first = (await open()).event;
  const second = (await open()).event;
  const telegramTopic = "8452";
  const commands = [first, second].map(({ dialogId }) => ({ dialogId, version: 1, id: randomUUID(), telegramTopic }));
  const results = await Promise.allSettled(commands.map(linkTelegramTopic));
  const success = results.findIndex(({ status }) => status === "fulfilled");
  assert.notEqual(success, -1);
  const failure = results[1 - success];
  assert.equal(failure.status, "rejected");
  if (failure.status === "rejected") assert.ok(errorCode("topic_conflict")(failure.reason));
  const command = commands[success];
  assert.equal((await linkTelegramTopic(command)).status, "duplicate");
  await assert.rejects(linkTelegramTopic({ ...command, telegramTopic: "8453" }), errorCode("id_conflict"));
  await assert.rejects(linkTelegramTopic({ ...command, telegramTopic: "8453", id: randomUUID() }), errorCode("topic_conflict"));
  assert.equal((await readDialog(command.dialogId)).consultation, "none");
});

test("concurrent ownership changes, staff takeover, close, reset and expiry invalidate pending work", async () => {
  const { event, consultationId } = await consult();
  const ops = [action(event.dialogId, 1, "takeover"), action(event.dialogId, 1, "takeover")];
  const results = await Promise.allSettled(ops.map(operate));
  assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
  await assert.rejects(answerConsultation({ dialogId: event.dialogId, version: 1, consultationId,
    id: randomUUID(), result: "Поздний ответ" }), errorCode("stale_state"));
  await operate(action(event.dialogId, 2, "takeover"));
  await assert.rejects(receive({ ...replyFor(event), version: 2, source: "staff", requestId: null }, []), errorCode("stale_state"));
  for (const ending of ["close", "reset", "expiry"] as const) {
    const active = await consult();
    const id = active.event.dialogId;
    if (ending === "close") await operate({ dialogId: id, id: randomUUID(), version: 1, action: "close" });
    if (ending === "reset") await session(active.access.token, true);
    if (ending === "expiry") await db.update(assistantDialogs).set({ expiresAt: new Date(0) }).where(eq(assistantDialogs.id, id));
    await assert.rejects(answerConsultation({ dialogId: id, version: 1, consultationId: active.consultationId,
      id: randomUUID(), result: "Поздний ответ" }), errorCode(ending === "close" ? "stale_state" : "dialog_not_found"));
  }
});

test("connection loss resends an identical webhook and allows an already-accepted callback", async (t) => {
  const { access, input, event } = await open();
  const wire: unknown[] = [];
  t.mock.method(globalThis, "fetch", async (_url: string | URL | Request, init: RequestInit) => {
    wire.push(init.body);
    throw new Error("Lost connection after acceptance");
  });
  const config = { url: new URL("http://127.0.0.1"), key: "test" };
  await finishDispatch(event, await deliverWebhook(config, event));
  const retry = await acceptGuest(access.token, input, context);
  assert.ok(retry);
  assert.equal(retry.attempt, 2);
  await finishDispatch(retry, await deliverWebhook(config, retry));
  assert.equal(wire.length, 4);
  assert.equal(new Set(wire).size, 1);
  const body = JSON.parse(String(wire[0]));
  assert.equal(body.text.includes("example.com"), false);
  assert.equal(Object.hasOwn(body, "attempt"), false);
  await receive(replyFor(event), []);
  assert.equal(await acceptGuest(access.token, input, context), null);
});

test("operator state is signed and disabling in admin blocks callbacks through re-enable", async () => {
  process.env.ASSISTANT_OPERATOR_KEY = "operator-test-key";
  process.env.ASSISTANT_N8N_CALLBACK_KEY = "assistant-test-key";
  const { event } = await open();
  try {
    assert.equal((await signedCall(["dialog", "state"], { dialogId: event.dialogId }, "assistant-test-key")).status, 401);
    const state = await signedCall(["dialog", "state"], { dialogId: event.dialogId }, "operator-test-key");
    assert.equal(state.status, 200);
    assert.equal((await state.json()).version, 1);
    const pending = replyFor(event);
    await settings(false);
    assert.equal((await signedCall(["callback"], pending, "assistant-test-key")).status, 503);
    await assert.rejects(receive(pending, []), errorCode("chat_unavailable"));
    await settings(true);
    assert.equal((await signedCall(["callback"], pending, "assistant-test-key")).status, 409);
    assert.equal((await readDialog(event.dialogId)).version, 2);
  } finally {
    await settings(true);
    delete process.env.ASSISTANT_OPERATOR_KEY;
    delete process.env.ASSISTANT_N8N_CALLBACK_KEY;
  }
});

test("expired dispatch leases restore the original visible and retryable message", async () => {
  const { access, event, input } = await open();
  await db.update(assistantMessages).set({ dispatchLease: new Date(0) })
    .where(and(eq(assistantMessages.dialogId, event.dialogId), eq(assistantMessages.id, event.id)));
  assert.equal((await readMessages(access.token)).messages[0].status, "failed");
  const recovered = await acceptGuest(access.token, input, async () => {
    assert.fail("the original context must be reused");
  });
  assert.ok(recovered);
  assert.deepEqual(recovered.context, event.context);
  assert.equal(recovered.attempt, 2);
  await finishDispatch(recovered, false);
  const third = await acceptGuest(access.token, input, context);
  assert.ok(third);
  await finishDispatch(third, false);
  await assert.rejects(acceptGuest(access.token, input, context), errorCode("delivery_exhausted"));
});

test("signed consultation endpoints isolate results and retain older open cases", async () => {
  process.env.ASSISTANT_OPERATOR_KEY = "operator-test";
  process.env.ASSISTANT_N8N_CALLBACK_KEY = "assistant-test";
  try {
    const { event, consultationId } = await consult();
    await db.insert(assistantConsultations).values(Array.from({ length: 12 }, () => ({
      id: randomUUID(), requestId: event.id, version: 1, dialogId: event.dialogId,
      question: "Уточнение", status: "delivered" as const, createdAt: new Date(Date.now() + 2000),
    })));
    assert.equal((await readDialog(event.dialogId)).consultations[0].id, consultationId);
    const command = { dialogId: event.dialogId, id: randomUUID(), version: 1, consultationId };
    const result = { ...command, result: "Подтверждено сотрудником" };
    assert.equal((await signedCall(["consultation", "result"], result, "assistant-test")).status, 401);
    assert.equal((await signedCall(["consultation", "result"], result, "operator-test")).status, 200);
    const delivery = { ...command, id: randomUUID(), text: "По вашему вопросу есть ответ." };
    assert.equal((await signedCall(["consultation", "deliver"], delivery, "operator-test")).status, 401);
    assert.equal((await signedCall(["consultation", "deliver"], delivery, "assistant-test")).status, 200);
    assert.equal((await signedCall(["consultation", "deliver"], { ...delivery, text: "Изменено" }, "assistant-test")).status, 409);
  } finally {
    delete process.env.ASSISTANT_OPERATOR_KEY;
    delete process.env.ASSISTANT_N8N_CALLBACK_KEY;
  }
});
