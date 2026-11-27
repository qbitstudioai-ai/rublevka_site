import { createHash, createHmac, randomBytes } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, lt, lte, isNull, ne, notInArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../events/db";
import { ApiError, canonicalJson, redact } from "./security";
import { bindTopic, callback, consultationDelivery, consultationResult, guestMessage, operator, pageContext, updateMemory } from "./chat-contract";
import { assistantDialogs as dialogs, assistantMessages as messages, assistantRates as rates,
  assistantReceipts as receipts, assistantConsultations as consultations, assistantSettings, type Card } from "./schema";

import { mergeMemory, publicNeed } from "./memory";

type Dialog = typeof dialogs.$inferSelect;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const windowSize = 40;
const maxEvents = 1000;
const answerTimeout = 120_000;
const leaseMs = 7000;
const maxAttempts = 3;

export function retentionSeconds() {
  const value = Number(process.env.ASSISTANT_RETENTION_HOURS ?? 24);
  return Number.isInteger(value) && value >= 1 && value <= 168 ? value * 3600 : 86400;
}
export function digest(token: string) { return createHash("sha256").update(token).digest("hex"); }

export async function cleanupExpired() {
  await db.delete(dialogs).where(lte(dialogs.expiresAt, new Date()));
  await db.delete(rates).where(lt(rates.bucket, Math.floor(Date.now() / 60000) - 1));
}

export async function limitRate(key: string, maximum: number) {
  const bucket = Math.floor(Date.now() / 60000);
  const [row] = await db.insert(rates).values({ key, bucket, count: 1 }).onConflictDoUpdate({
    target: rates.key, set: {
      bucket, count: sql`case when ${rates.bucket} = ${bucket} then ${rates.count} + 1 else 1 end`,
    }, setWhere: sql`${rates.bucket} <> ${bucket} or ${rates.count} < ${maximum}`,
  }).returning({ count: rates.count });
  if (!row) throw new ApiError(429, "rate_limited");
}

export async function session(token: string | undefined, reset: boolean) {
  if (token && !reset) {
    const [existing] = await db.select({ id: dialogs.id }).from(dialogs).where(
      and(eq(dialogs.sessionHash, digest(token)), gt(dialogs.expiresAt, new Date())));
    if (existing) return { token, created: false };
  }
  return db.transaction(async (tx) => {
    if (token) await tx.delete(dialogs).where(eq(dialogs.sessionHash, digest(token)));
    const next = randomBytes(32).toString("base64url");
    await tx.insert(dialogs).values({ sessionHash: digest(next), expiresAt: new Date(Date.now() + retentionSeconds() * 1000) });
    return { token: next, created: true };
  });
}

async function locked<T>(
  match: ReturnType<typeof eq>, action: (tx: Transaction, dialog: Dialog) => Promise<T>, enabled = false,
) {
  return db.transaction(async (tx) => {
    if (enabled) {
      const [settings] = await tx.select({ enabled: assistantSettings.enabled }).from(assistantSettings)
        .where(eq(assistantSettings.id, 1)).for("share");
      if (process.env.ASSISTANT_CHAT_ENABLED !== "true" || !settings?.enabled)
        throw new ApiError(503, "chat_unavailable");
    }
    const [dialog] = await tx.select().from(dialogs).where(match).for("update");
    if (!dialog || dialog.expiresAt.getTime() <= Date.now()) throw new ApiError(404, "dialog_not_found");
    return action(tx, dialog);
  });
}

async function byId(tx: Transaction, dialog: Dialog, id: string) {
  const [message] = await tx.select().from(messages).where(and(eq(messages.dialogId, dialog.id), eq(messages.id, id))).limit(1);
  return message;
}
function fingerprint(input: object, secret: string) {
  return createHmac("sha256", process.env.ASSISTANT_N8N_WEBHOOK_KEY || secret).update(canonicalJson(input)).digest("hex");
}

async function receipt(tx: Transaction, dialog: Dialog, input: { id: string }, kind: string) {
  const hash = fingerprint(input, dialog.sessionHash);
  const where = and(eq(receipts.dialogId, dialog.id), eq(receipts.id, input.id));
  const [existing] = await tx.select().from(receipts).where(where);
  if (existing) {
    if (existing.kind !== kind || existing.fingerprint !== hash) throw new ApiError(409, "id_conflict");
    return false;
  }
  const [{ total }] = await tx.select({ total: sql<number>`count(*)::int` }).from(receipts).where(eq(receipts.dialogId, dialog.id));
  if (total >= maxEvents) throw new ApiError(409, "dialog_limit");
  await tx.insert(receipts).values({ dialogId: dialog.id, id: input.id, kind, fingerprint: hash });
  return true;
}

async function expirePending(tx: Transaction, id: string) {
  await tx.update(messages).set({ status: "failed", webhook: null, dispatchLease: null }).where(and(
    eq(messages.dialogId, id), or(eq(messages.status, "pending"), eq(messages.status, "sending"), sql`${messages.webhook} is not null`),
    lt(messages.createdAt, new Date(Date.now() - answerTimeout)),
  ));
}

async function prune(tx: Transaction, id: string) {
  const [oldest] = await tx.select({ sequence: messages.sequence }).from(messages).where(eq(messages.dialogId, id))
    .orderBy(desc(messages.sequence)).offset(windowSize - 1).limit(1);
  if (oldest) await tx.delete(messages).where(and(eq(messages.dialogId, id), lt(messages.sequence, oldest.sequence),
    or(eq(messages.source, "guest"), ne(messages.status, "complete"), sql`${messages.deliveredAt} is not null`)));
}

export async function requireDialog(token: string) {
  const [dialog] = await db.select({ id: dialogs.id }).from(dialogs).where(
    and(eq(dialogs.sessionHash, digest(token)), gt(dialogs.expiresAt, new Date())));
  if (!dialog) throw new ApiError(404, "dialog_not_found");
  return dialog.id;
}

export function readMessages(token: string) {
  return locked(eq(dialogs.sessionHash, digest(token)), async (tx, dialog) => {
    await expirePending(tx, dialog.id);
    await tx.update(messages).set({ status: "failed", dispatchLease: null }).where(and(
      eq(messages.dialogId, dialog.id), eq(messages.status, "sending"), lte(messages.dispatchLease, new Date()),
    ));
    const queued = await tx.select().from(messages).where(and(eq(messages.dialogId, dialog.id),
      ne(messages.source, "guest"), isNull(messages.deliveredAt), eq(messages.status, "complete")))
      .orderBy(asc(messages.sequence)).limit(20);
    const recent = await tx.select().from(messages).where(and(eq(messages.dialogId, dialog.id),
      ne(messages.status, "cancelled"), queued.length ? notInArray(messages.sequence, queued.map((row) => row.sequence)) : undefined))
      .orderBy(desc(messages.sequence)).limit(windowSize - queued.length);
    const rows = [...queued, ...recent].sort((first, second) => first.sequence - second.sequence);
    return { owner: dialog.owner, closed: dialog.closed, acknowledge: queued.map((row) => row.id), messages: rows.map((row) => ({
      id: row.id, sequence: row.sequence, source: row.source, requestId: row.requestId, text: row.text,
      cards: row.cards, status: row.status === "sending" ? "pending" : row.status, sending: row.status === "sending", createdAt: row.createdAt.toISOString(),
    })) };
  });
}

export function acknowledge(token: string, ids: string[]) {
  return locked(eq(dialogs.sessionHash, digest(token)), async (tx, dialog) => {
    await tx.update(messages).set({ deliveredAt: new Date() }).where(and(eq(messages.dialogId, dialog.id),
      ne(messages.source, "guest"), eq(messages.status, "complete"), isNull(messages.deliveredAt), inArray(messages.id, ids)));
    await prune(tx, dialog.id);
  });
}

async function consultationRows(tx: Transaction, dialogId: string) {
  return tx.select().from(consultations).where(and(eq(consultations.dialogId, dialogId),
    ne(consultations.status, "cancelled")))
    .orderBy(sql`case when ${consultations.status} in ('requested', 'answered') then 0 else 1 end`, desc(consultations.createdAt))
    .limit(12);
}
function consultationState(rows: Awaited<ReturnType<typeof consultationRows>>) {
  if (rows.some((row) => row.status === "requested")) return "requested";
  return rows.length ? "completed" : "none";
}

async function modelHistory(tx: Transaction, dialogId: string) {
  const rows = await tx.select({ source: messages.source, text: messages.text }).from(messages)
    .where(and(eq(messages.dialogId, dialogId), ne(messages.source, "staff"),
      or(eq(messages.status, "complete"), and(eq(messages.source, "guest"), ne(messages.status, "cancelled")))))
    .orderBy(desc(messages.sequence)).limit(12);
  return rows.reverse().map((entry) => ({ ...entry, text: redact(entry.text) }));
}

async function dialogState(tx: Transaction, dialog: Dialog) {
  const rows = await consultationRows(tx, dialog.id);
  return {
    dialogId: dialog.id, version: dialog.version, owner: dialog.owner, status: dialog.closed ? "closed" : "active",
    telegramTopic: dialog.telegramTopic, consultation: consultationState(rows),
    salesStage: dialog.salesStage === null ? null : redact(dialog.salesStage),
    need: publicNeed(dialog.need), summary: dialog.summary === null ? null : redact(dialog.summary),
    history: await modelHistory(tx, dialog.id), expiresAt: dialog.expiresAt.toISOString(),
    consultations: rows.map(({ id, requestId, question, result, status, createdAt }) =>
      ({ id, requestId, question, result, status, createdAt: createdAt.toISOString() })),
  };
}

export function readDialog(id: string) {
  return locked(eq(dialogs.id, id), dialogState, true);
}

type Context = Awaited<ReturnType<typeof pageContext>>;
type WebhookEvent = {
  protocol: "1"; dialogId: string; id: string; text: string; time: string; context: Context;
  dialog: Omit<Awaited<ReturnType<typeof dialogState>>, "dialogId" | "status" | "expiresAt" | "consultations">;
};
type Dispatch = WebhookEvent & { attempt: number };

export function acceptGuest(
  token: string, input: z.infer<typeof guestMessage>, context: Context | (() => Promise<Context>),
): Promise<Dispatch | null> {
  return locked(eq(dialogs.sessionHash, digest(token)), async (tx, dialog) => {
    await expirePending(tx, dialog.id);
    const inserted = await receipt(tx, dialog, input, "guest");
    if (!inserted) {
      const row = await byId(tx, dialog, input.id);
      if (row?.status === "failed" && (!row.webhook || row.dispatchAttempts >= maxAttempts))
        throw new ApiError(409, "delivery_exhausted");
      if (dialog.closed || !row?.webhook || row.version !== dialog.version ||
          Date.now() - row.createdAt.getTime() >= answerTimeout || row.dispatchAttempts >= maxAttempts ||
          (row.status !== "failed" && row.status !== "sending") ||
          (row.dispatchLease && row.dispatchLease.getTime() > Date.now())) return null;
      const [latest] = await tx.select({ id: messages.id }).from(messages)
        .where(and(eq(messages.dialogId, dialog.id), eq(messages.source, "guest")))
        .orderBy(desc(messages.sequence)).limit(1);
      if (latest?.id !== row.id) throw new ApiError(409, "delivery_exhausted");
      const attempt = row.dispatchAttempts + 1;
      await tx.update(messages).set({ status: "sending", dispatchAttempts: attempt, dispatchLease: new Date(Date.now() + leaseMs) })
        .where(eq(messages.sequence, row.sequence));
      return { ...(row.webhook as WebhookEvent), attempt };
    }
    if (dialog.closed) throw new ApiError(409, "dialog_closed");
    const [pending] = await tx.select({ id: messages.id }).from(messages).where(and(eq(messages.dialogId, dialog.id),
      or(eq(messages.status, "sending"), eq(messages.status, "pending")))).limit(1);
    if (pending && dialog.owner === "assistant") throw new ApiError(409, "reply_pending");
    const state = await dialogState(tx, dialog);
    const resolvedContext = typeof context === "function" ? await context() : context;
    const time = new Date();
    const text = redact(input.text);
    const event: WebhookEvent = {
      protocol: "1", dialogId: dialog.id, id: input.id, text, time: time.toISOString(), context: resolvedContext,
      dialog: { version: state.version, owner: state.owner, consultation: state.consultation, telegramTopic: state.telegramTopic,
        salesStage: state.salesStage, need: state.need, summary: state.summary, history: state.history },
    };
    await tx.insert(messages).values({ dialogId: dialog.id, id: input.id, source: "guest", text,
      version: dialog.version, status: "sending", webhook: event, dispatchAttempts: 1, dispatchLease: new Date(time.getTime() + leaseMs) });
    await prune(tx, dialog.id);
    return { ...event, attempt: 1 };
  }, true);
}

export async function finishDispatch(event: Dispatch, sent: boolean) {
  await db.update(messages).set({
    status: sent ? (event.dialog.owner === "staff" ? "complete" : "pending") : "failed",
    webhook: sent ? null : undefined, dispatchLease: null,
  }).where(and(eq(messages.dialogId, event.dialogId), eq(messages.id, event.id), eq(messages.status, "sending"),
    eq(messages.dispatchAttempts, event.attempt)));
}

export async function checkCallbackReplay(input: { id: string; dialogId: string }, kind: string) {
  const [row] = await db.select({ kind: receipts.kind, fingerprint: receipts.fingerprint, secret: dialogs.sessionHash })
    .from(receipts).innerJoin(dialogs, eq(receipts.dialogId, dialogs.id))
    .where(and(eq(receipts.dialogId, input.dialogId), eq(receipts.id, input.id), gt(dialogs.expiresAt, new Date())));
  if (!row) return false;
  if (row.kind !== kind || row.fingerprint !== fingerprint(input, row.secret)) throw new ApiError(409, "id_conflict");
  return true;
}

function requireVersion(dialog: Dialog, version: number, owner?: Dialog["owner"]) {
  if (dialog.closed || dialog.version !== version || (owner && dialog.owner !== owner))
    throw new ApiError(409, "stale_state");
}

async function publish(tx: Transaction, dialog: Dialog, input: {
  id: string; source: "assistant" | "staff"; requestId: string | null; text: string;
}, cards: Card[]) {
  const [{ total }] = await tx.select({ total: sql<number>`count(*)::int` }).from(messages)
    .where(and(eq(messages.dialogId, dialog.id), ne(messages.source, "guest"), isNull(messages.deliveredAt),
      eq(messages.status, "complete")));
  if (total >= 20) throw new ApiError(409, "delivery_queue_full");
  await tx.insert(messages).values({ dialogId: dialog.id, id: input.id, source: input.source,
    requestId: input.requestId, version: dialog.version, text: input.text, cards, status: "complete" });
  await prune(tx, dialog.id);
}

export function receive(input: z.infer<typeof callback>, cards: Card[]) {
  return locked(eq(dialogs.id, input.dialogId), async (tx, dialog) => {
    if (!(await receipt(tx, dialog, input, input.source))) return { status: "duplicate" };
    requireVersion(dialog, input.version, input.source);
    const guest = input.requestId ? await byId(tx, dialog, input.requestId) : null;
    if (input.requestId && guest?.source !== "guest") throw new ApiError(409, "unknown_request");
    if (input.source === "assistant") {
      if (!guest || guest.version !== input.version || !["pending", "sending", "failed"].includes(guest.status) ||
          Date.now() - guest.createdAt.getTime() > answerTimeout) throw new ApiError(409, "stale_request");
      if (guest.status === "failed") {
        const [newer] = await tx.select({ id: messages.id }).from(messages).where(and(eq(messages.dialogId, dialog.id),
          eq(messages.source, "guest"), gt(messages.sequence, guest.sequence))).limit(1);
        if (newer || !guest.webhook) throw new ApiError(409, "stale_request");
      }
    }
    if (guest) await tx.update(messages).set({
      status: input.status === "completed" ? "complete" : "failed", webhook: null, dispatchLease: null,
    }).where(eq(messages.sequence, guest.sequence));
    if (input.status === "completed") {
      if (input.memory) await tx.update(dialogs).set(mergeMemory(dialog, input.memory)).where(eq(dialogs.id, dialog.id));
      if (input.consultation && guest) {
        const [{ total }] = await tx.select({ total: sql<number>`count(*)::int` }).from(consultations)
          .where(and(eq(consultations.dialogId, dialog.id), or(eq(consultations.status, "requested"), eq(consultations.status, "answered"))));
        if (total >= 8) throw new ApiError(409, "consultation_limit");
        const [created] = await tx.insert(consultations).values({ id: input.consultation.id, dialogId: dialog.id,
          requestId: guest.id, version: dialog.version, question: redact(input.consultation.question),
        }).onConflictDoNothing().returning({ id: consultations.id });
        if (!created) throw new ApiError(409, "consultation_conflict");
      }
      await publish(tx, dialog, input, cards);
    }
    return { status: "accepted" };
  }, true);
}

type Command = { dialogId: string; version: number; id: string };
function command<T extends Command, R>(input: T, kind: string, apply: (tx: Transaction, dialog: Dialog) => Promise<R>) {
  return locked(eq(dialogs.id, input.dialogId), async (tx, dialog) => {
    if (!(await receipt(tx, dialog, input, kind))) return { status: "duplicate" as const, owner: dialog.owner, version: dialog.version, closed: dialog.closed };
    requireVersion(dialog, input.version);
    return { status: "accepted" as const, ...await apply(tx, dialog) };
  }, true);
}

export function patchDialogMemory(input: z.infer<typeof updateMemory>) {
  return command(input, "memory", async (tx, dialog) => {
    await tx.update(dialogs).set(mergeMemory(dialog, input.memory)).where(eq(dialogs.id, dialog.id));
    return { version: dialog.version };
  });
}

export function linkTelegramTopic(input: z.infer<typeof bindTopic>) {
  return command(input, "topic", async (tx, dialog) => {
    if (dialog.telegramTopic && dialog.telegramTopic !== input.telegramTopic) throw new ApiError(409, "topic_conflict");
    if (!dialog.telegramTopic) {
      try { await tx.update(dialogs).set({ telegramTopic: input.telegramTopic }).where(eq(dialogs.id, dialog.id)); }
      catch (error) {
        if (error instanceof Error && (error.cause as { code?: string; constraint?: string } | undefined)?.constraint === "assistant_dialogs_topic")
          throw new ApiError(409, "topic_conflict");
        throw error;
      }
    }
    return { version: dialog.version, telegramTopic: input.telegramTopic };
  });
}

function openConsultation(tx: Transaction, dialog: Dialog, id: string, expected: "requested" | "answered") {
  return tx.select().from(consultations).where(and(eq(consultations.id, id), eq(consultations.dialogId, dialog.id)))
    .then(([row]) => {
      if (!row) throw new ApiError(404, "consultation_not_found");
      if (row.status !== expected || row.version !== dialog.version || dialog.owner !== "assistant")
        throw new ApiError(409, "stale_consultation");
      return row;
    });
}

export function answerConsultation(input: z.infer<typeof consultationResult>) {
  return command(input, "consultation_result", async (tx, dialog) => {
    const row = await openConsultation(tx, dialog, input.consultationId, "requested");
    await tx.update(consultations).set({ status: "answered", result: redact(input.result) }).where(eq(consultations.id, row.id));
    return { consultationId: row.id };
  });
}

export function deliverConsultation(input: z.infer<typeof consultationDelivery>, cards: Card[]) {
  return command(input, "consultation_delivery", async (tx, dialog) => {
    const row = await openConsultation(tx, dialog, input.consultationId, "answered");
    // The employee's result is transport data, never copied into dialog memory by default.
    if (input.memory) await tx.update(dialogs).set(mergeMemory(dialog, input.memory)).where(eq(dialogs.id, dialog.id));
    await publish(tx, dialog, { ...input, source: "assistant", requestId: row.requestId }, cards);
    await tx.update(consultations).set({ status: "delivered", result: null }).where(eq(consultations.id, row.id));
    return { consultationId: row.id };
  });
}

export function operate(input: z.infer<typeof operator>) {
  return command(input, "operator", async (tx, dialog) => {
    if (input.action === "release" && dialog.owner !== "staff") throw new ApiError(409, "stale_state");
    const owner = input.action === "takeover" ? "staff" : input.action === "release" ? "assistant" : dialog.owner;
    const closed = input.action === "close";
    const version = dialog.version + 1;
    await tx.update(messages).set({ status: "cancelled" }).where(and(eq(messages.dialogId, dialog.id),
      ne(messages.source, "guest"), isNull(messages.deliveredAt)));
    await tx.update(messages).set({ status: "complete", webhook: null, dispatchLease: null }).where(and(eq(messages.dialogId, dialog.id),
      eq(messages.source, "guest"), or(eq(messages.status, "pending"), eq(messages.status, "sending"), sql`${messages.webhook} is not null`)));
    await tx.update(consultations).set({ status: "cancelled", result: null }).where(and(eq(consultations.dialogId, dialog.id),
      or(eq(consultations.status, "requested"), eq(consultations.status, "answered"))));
    await tx.update(dialogs).set({ owner, closed, version }).where(eq(dialogs.id, dialog.id));
    return { owner, version, closed, consultation: consultationState(await consultationRows(tx, dialog.id)) };
  });
}
