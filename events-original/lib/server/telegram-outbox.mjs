// Durable outbox Telegram-уведомлений в SQLite.
// Используется приложением (быстрая попытка после регистрации, кнопка в админке)
// и CLI `npm run telegram:retry` (cron). Типы — в telegram-outbox.d.mts.
//
// Модель статусов:
//   pending — ждёт отправки; после неудачной попытки остаётся pending, пока attempts < MAX_ATTEMPTS;
//   sent    — доставлено, повторно не отправляется;
//   failed  — попытки исчерпаны; повторяется только по явной команде (кнопка в админке, --include-failed).
//
// Захват записи (locked_until) — атомарный UPDATE, поэтому приложение и CLI не отправят одно
// уведомление одновременно. Если процесс остановился во время отправки, захват истекает
// и запись обрабатывается снова (доставка «хотя бы один раз»).

import { describeFailure, formatRegistrationMessage, redactSecret, sendTelegramMessage } from "./telegram.mjs";

export const MAX_ATTEMPTS = 5;
export const LOCK_SECONDS = 120;
export const DEFAULT_BATCH_SIZE = 20;

const iso = (date) => date.toISOString();
const plusSeconds = (date, seconds) => new Date(date.getTime() + seconds * 1000);

/** Создаёт pending-запись для регистрации. Вызывается внутри транзакции регистрации. */
export function enqueueRegistrationNotification(db, registrationId) {
  db.prepare("INSERT OR IGNORE INTO telegram_notification_outbox (registration_id) VALUES (?)").run(registrationId);
}

/**
 * Данные для уведомления: название мероприятия и идентификаторы для ссылки в админку.
 * Персональные данные участника не читаются — в Telegram (зарубежный сервис) они не уходят.
 */
export function loadRegistrationNotice(db, registrationId) {
  const row = db
    .prepare("SELECT r.public_id, e.id AS event_id, e.title FROM registrations r JOIN events e ON e.id = r.event_id WHERE r.id = ?")
    .get(registrationId);
  if (!row) return null;
  return { event: { id: row.event_id, title: row.title }, registration: { public_id: row.public_id } };
}

function claim(db, outboxId, now, includeFailed) {
  const statuses = includeFailed ? "('pending', 'failed')" : "('pending')";
  return (
    db
      .prepare(
        `UPDATE telegram_notification_outbox
         SET locked_until = @lockedUntil, last_attempt_at = @now, attempts = attempts + 1
         WHERE id = @id AND status IN ${statuses} AND (locked_until IS NULL OR locked_until <= @now)`,
      )
      .run({ id: outboxId, now: iso(now), lockedUntil: iso(plusSeconds(now, LOCK_SECONDS)) }).changes === 1
  );
}

/**
 * Пытается отправить одно уведомление.
 * Возвращает: "sent" | "retry" (остаётся pending) | "failed" (попытки исчерпаны) | "skipped" (уже отправлено или занято).
 */
export async function deliverOutboxEntry(db, config, outboxId, options = {}) {
  const now = options.now ?? new Date();
  if (!claim(db, outboxId, now, options.includeFailed ?? false)) return "skipped";

  const entry = db.prepare("SELECT registration_id, attempts FROM telegram_notification_outbox WHERE id = ?").get(outboxId);
  const notice = entry && loadRegistrationNotice(db, entry.registration_id);
  let result;
  if (!notice) {
    result = { ok: false, reason: "api", description: "registration not found" };
  } else {
    try {
      result = await sendTelegramMessage(config, formatRegistrationMessage(notice, config.appUrl), options);
    } catch {
      result = { ok: false, reason: "network" };
    }
  }

  if (result.ok) {
    db.prepare(
      `UPDATE telegram_notification_outbox
       SET status = 'sent', sent_at = ?, last_error = NULL, locked_until = NULL WHERE id = ?`,
    ).run(iso(options.now ?? new Date()), outboxId);
    return "sent";
  }

  // В БД — только краткая причина; токен вырезается даже если оказался в описании ошибки.
  const lastError = redactSecret(describeFailure(result), config.token).slice(0, 300);
  const exhausted = entry.attempts >= MAX_ATTEMPTS;
  db.prepare(
    `UPDATE telegram_notification_outbox
     SET status = CASE WHEN status = 'failed' OR @exhausted THEN 'failed' ELSE 'pending' END,
         last_error = @lastError, locked_until = NULL
     WHERE id = @id`,
  ).run({ id: outboxId, exhausted: exhausted ? 1 : 0, lastError });
  const log = options.log ?? ((message) => console.error(message));
  log(redactSecret(`Telegram: уведомление (outbox ${outboxId}) не отправлено: ${lastError}`, config.token));
  const { status } = db.prepare("SELECT status FROM telegram_notification_outbox WHERE id = ?").get(outboxId);
  return status === "failed" ? "failed" : "retry";
}

/** Быстрая попытка сразу после регистрации (по id регистрации). */
export async function deliverRegistrationNotification(db, config, registrationId, options = {}) {
  const entry = db.prepare("SELECT id FROM telegram_notification_outbox WHERE registration_id = ?").get(registrationId);
  return entry ? deliverOutboxEntry(db, config, entry.id, options) : "skipped";
}

/**
 * Обрабатывает ожидающие уведомления (старые первыми), не больше `limit` за запуск.
 * `includeFailed` — дополнительно повторить записи с исчерпанными попытками (ручной повтор).
 */
export async function processPendingTelegramNotifications(db, config, options = {}) {
  const now = options.now ?? new Date();
  const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_BATCH_SIZE, 500));
  const statuses = options.includeFailed ? "('pending', 'failed')" : "('pending')";
  const ids = db
    .prepare(
      `SELECT id FROM telegram_notification_outbox
       WHERE status IN ${statuses} AND (locked_until IS NULL OR locked_until <= ?)
       ORDER BY created_at, id LIMIT ?`,
    )
    .all(iso(now), limit)
    .map((row) => row.id);

  const summary = { processed: 0, sent: 0, retry: 0, failed: 0, skipped: 0 };
  for (const id of ids) {
    const outcome = await deliverOutboxEntry(db, config, id, { ...options, now });
    summary[outcome] += 1;
    if (outcome !== "skipped") summary.processed += 1;
  }
  return summary;
}

/** Счётчики для админпанели и CLI. */
export function outboxStats(db) {
  const rows = db.prepare("SELECT status, COUNT(*) AS count FROM telegram_notification_outbox GROUP BY status").all();
  const stats = { pending: 0, sent: 0, failed: 0 };
  for (const row of rows) stats[row.status] = row.count;
  return stats;
}
