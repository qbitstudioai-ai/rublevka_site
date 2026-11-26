import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, lt, lte, isNull, ne, notInArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../events/db";
import { ApiError, redact } from "./security";
import { callback, guestMessage, operator, pageContext } from "./chat-contract";
import { assistantDialogs as dialogs, assistantMessages as messages, assistantRates as rates,
  assistantReceipts as receipts, type Card } from "./schema";

type Dialog = typeof dialogs.$inferSelect;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const windowSize = 40;
const maxEvents = 1000;
const answerTimeout = 120_000;

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

async function locked<T>(match: ReturnType<typeof eq>, action: (tx: Transaction, dialog: Dialog) => Promise<T>) {
  return db.transaction(async (tx) => {
    const [dialog] = await tx.select().from(dialogs).where(and(match, gt(dialogs.expiresAt, new Date()))).for("update");
    if (!dialog) throw new ApiError(404, "dialog_not_found");
    return action(tx, dialog);
  });
}

async function byId(tx: Transaction, dialog: Dialog, id: string) {
  const [message] = await tx.select().from(messages).where(and(eq(messages.dialogId, dialog.id), eq(messages.id, id))).limit(1);
  return message;
}
async function receipt(tx: Transaction, dialog: Dialog, id: string, kind: string) {
  const where = and(eq(receipts.dialogId, dialog.id), eq(receipts.id, id));
  const [existing] = await tx.select({ kind: receipts.kind }).from(receipts).where(where);
  if (existing) {
    if (existing.kind !== kind) throw new ApiError(409, "id_conflict");
    return false;
  }
  const [{ total }] = await tx.select({ total: sql<number>`count(*)::int` }).from(receipts).where(eq(receipts.dialogId, dialog.id));
  if (total >= maxEvents) throw new ApiError(409, "dialog_limit");
  await tx.insert(receipts).values({ dialogId: dialog.id, id, kind });
  return true;
}

async function expirePending(tx: Transaction, id: string) {
  await tx.update(messages).set({ status: "failed" }).where(and(
    eq(messages.dialogId, id), or(eq(messages.status, "pending"), eq(messages.status, "sending")),
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
    const queued = await tx.select().from(messages).where(and(eq(messages.dialogId, dialog.id),
      ne(messages.source, "guest"), isNull(messages.deliveredAt), eq(messages.status, "complete")))
      .orderBy(asc(messages.sequence)).limit(20);
    const recent = await tx.select().from(messages).where(and(eq(messages.dialogId, dialog.id),
      ne(messages.status, "cancelled"), queued.length ? notInArray(messages.sequence, queued.map((row) => row.sequence)) : undefined))
      .orderBy(desc(messages.sequence)).limit(windowSize - queued.length);
    const rows = [...queued, ...recent].sort((first, second) => first.sequence - second.sequence);
    return { owner: dialog.owner, closed: dialog.closed, acknowledge: queued.map((row) => row.id), messages: rows.map((row) => ({
      id: row.id, sequence: row.sequence, source: row.source, requestId: row.requestId, text: row.text,
      cards: row.cards, status: row.status === "sending" ? "pending" : row.status, createdAt: row.createdAt.toISOString(),
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

export function acceptGuest(
  token: string, input: z.infer<typeof guestMessage>, context: Awaited<ReturnType<typeof pageContext>>,
) {
  return locked(eq(dialogs.sessionHash, digest(token)), async (tx, dialog) => {
    await expirePending(tx, dialog.id);
    const inserted = await receipt(tx, dialog, input.id, "guest");
    if (!inserted) return null;
    if (dialog.closed) throw new ApiError(409, "dialog_closed");
    const [pending] = await tx.select({ id: messages.id }).from(messages).where(and(eq(messages.dialogId, dialog.id),
      or(eq(messages.status, "sending"), eq(messages.status, "pending")))).limit(1);
    if (pending && dialog.owner === "assistant") throw new ApiError(409, "reply_pending");
    const text = redact(input.text);
    await tx.insert(messages).values({ dialogId: dialog.id, id: input.id, source: "guest", text,
      version: dialog.version, status: "sending" });
    const history = await tx.select({ source: messages.source, text: messages.text }).from(messages)
      .where(and(eq(messages.dialogId, dialog.id), ne(messages.id, input.id),
        or(eq(messages.status, "complete"), and(eq(messages.source, "guest"), ne(messages.status, "cancelled")))))
      .orderBy(desc(messages.sequence)).limit(12);
    await prune(tx, dialog.id);
    return { protocol: "1", dialogId: dialog.id, id: input.id, text, time: new Date().toISOString(), context,
      dialog: { version: dialog.version, owner: dialog.owner, consultation: dialog.consultation,
        telegramTopic: dialog.telegramTopic, salesStage: dialog.salesStage, need: dialog.need,
        summary: dialog.summary, history: history.reverse().map((entry) => ({ ...entry, text: redact(entry.text) })) },
    };
  });
}

export async function finishDispatch(event: NonNullable<Awaited<ReturnType<typeof acceptGuest>>>, sent: boolean) {
  await db.update(messages).set({ status: sent ? (event.dialog.owner === "staff" ? "complete" : "pending") : "failed" })
    .where(and(eq(messages.dialogId, event.dialogId), eq(messages.id, event.id), eq(messages.status, "sending")));
}

export async function duplicateCallback(input: z.infer<typeof callback>) {
  const [row] = await db.select({ kind: receipts.kind }).from(receipts).innerJoin(dialogs, eq(receipts.dialogId, dialogs.id))
    .where(and(eq(receipts.dialogId, input.dialogId), eq(receipts.id, input.id), gt(dialogs.expiresAt, new Date())));
  return row?.kind === input.source;
}

export function receive(input: z.infer<typeof callback>, cards: Card[]) {
  return locked(eq(dialogs.id, input.dialogId), async (tx, dialog) => {
    if (!(await receipt(tx, dialog, input.id, input.source))) return { status: "duplicate" };
    if (dialog.closed || dialog.version !== input.version || dialog.owner !== input.source)
      throw new ApiError(409, "stale_state");
    const guest = input.requestId ? await byId(tx, dialog, input.requestId) : null;
    if (input.requestId && guest?.source !== "guest") throw new ApiError(409, "unknown_request");
    if (input.source === "assistant" &&
      (!guest || guest.version !== input.version || !["pending", "sending"].includes(guest.status) ||
        Date.now() - guest.createdAt.getTime() > answerTimeout))
      throw new ApiError(409, "stale_request");
    if (guest) await tx.update(messages).set({ status: input.status === "completed" ? "complete" : "failed" })
      .where(eq(messages.sequence, guest.sequence));
    if (input.status === "completed") {
      const [{ total }] = await tx.select({ total: sql<number>`count(*)::int` }).from(messages)
        .where(and(eq(messages.dialogId, dialog.id), ne(messages.source, "guest"), isNull(messages.deliveredAt),
          eq(messages.status, "complete")));
      if (total >= 20) throw new ApiError(409, "delivery_queue_full");
      await tx.insert(messages).values({ dialogId: dialog.id, id: input.id, source: input.source,
        requestId: input.requestId, version: dialog.version, text: input.text, cards, status: "complete" });
    }
    await prune(tx, dialog.id);
    return { status: "accepted" };
  });
}

export function operate(input: z.infer<typeof operator>) {
  return locked(eq(dialogs.id, input.dialogId), async (tx, dialog) => {
    if (!(await receipt(tx, dialog, input.id, "operator")))
      return { status: "duplicate", owner: dialog.owner, version: dialog.version, closed: dialog.closed, consultation: dialog.consultation };
    if (dialog.closed || dialog.version !== input.version) throw new ApiError(409, "stale_state");
    const owner = input.action === "takeover" ? "staff" : input.action === "release" ? "assistant" : dialog.owner;
    const closed = input.action === "close";
    const version = dialog.version + (owner !== dialog.owner || closed ? 1 : 0);
    const consultation = input.action === "request_consultation" ? "requested"
      : input.action === "complete_consultation" ? "completed" : dialog.consultation;
    if (version !== dialog.version) {
      await tx.update(messages).set({ status: "cancelled" }).where(and(
        eq(messages.dialogId, dialog.id), eq(messages.source, "assistant"), isNull(messages.deliveredAt),
      ));
      await tx.update(messages).set({ status: "complete" }).where(and(eq(messages.dialogId, dialog.id),
        eq(messages.source, "guest"), or(eq(messages.status, "pending"), eq(messages.status, "sending")),
      ));
    }
    await tx.update(dialogs).set({ owner, closed, version, consultation,
      telegramTopic: input.telegramTopic, salesStage: input.salesStage === undefined ? undefined : redact(input.salesStage), need: input.need,
      summary: input.summary === undefined ? undefined : redact(input.summary),
    }).where(eq(dialogs.id, dialog.id));
    return { status: "accepted", owner, version, closed, consultation };
  });
}
