import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { PricingType } from "../../money";
import { enqueueRegistrationNotification } from "../telegram-outbox.mjs";
import type { RegistrationInput } from "../validation";

export type RegistrationRow = {
  id: number;
  public_id: string;
  event_id: number;
  full_name: string;
  phone: string;
  /** NULL — участник не указал мессенджер. */
  messenger: string | null;
  /** Стоимость участия на момент регистрации (snapshot); 0 — участие было бесплатным. */
  event_price_kopecks: number;
  /** Итог к оплате: участие + услуги с фиксированной ценой. */
  fixed_total_kopecks: number;
  created_at: string;
};

export type RegistrationActivitySnapshot = {
  activity_id: number | null;
  activity_title_snapshot: string;
  pricing_type_snapshot: PricingType;
  fixed_price_kopecks_snapshot: number | null;
  price_suffix_snapshot: string | null;
  start_time_snapshot: string | null;
};

export type RegistrationWithActivities = RegistrationRow & { activities: RegistrationActivitySnapshot[] };

export class RegistrationError extends Error {
  constructor(
    public readonly code: "event_unavailable" | "event_closed" | "activity_unavailable",
    message: string,
  ) {
    super(message);
  }
}

type ActivityPriceRow = {
  id: number;
  title: string;
  pricing_type: PricingType;
  fixed_price_kopecks: number | null;
  price_suffix: string | null;
  start_time: string | null;
};

/**
 * Создаёт регистрацию. Стоимость клиент не передаёт: сервер берёт услуги из БД,
 * проверяет принадлежность мероприятию и активность, считает фиксированный итог
 * и сохраняет snapshots — всё в одной транзакции.
 * `options.today` (YYYY-MM-DD) — закрыть регистрацию, если дата мероприятия раньше;
 * публичная регистрация передаёт его всегда.
 */
export function createRegistration(
  db: Database.Database,
  eventId: number,
  input: RegistrationInput,
  options: { enqueueTelegram?: boolean; today?: string } = {},
): RegistrationWithActivities {
  return db.transaction(() => {
    const event = db.prepare("SELECT id, event_date, price_kopecks FROM events WHERE id = ? AND status = 'published'").get(eventId) as
      | { id: number; event_date: string; price_kopecks: number | null }
      | undefined;
    if (!event) throw new RegistrationError("event_unavailable", "Регистрация на это мероприятие закрыта.");
    if (options.today && event.event_date < options.today) {
      throw new RegistrationError("event_closed", "Регистрация закрыта: мероприятие уже прошло.");
    }

    let selected: ActivityPriceRow[] = [];
    if (input.activityIds.length) {
      const placeholders = input.activityIds.map(() => "?").join(",");
      selected = db
        .prepare(
          `SELECT id, title, pricing_type, fixed_price_kopecks, price_suffix, start_time FROM activities
           WHERE event_id = ? AND is_active = 1 AND id IN (${placeholders})
           ORDER BY sort_order, id`,
        // Этот порядок совпадает с порядком карточек в анкете и сохраняется в snapshot как position.
        )
        .all(eventId, ...input.activityIds) as ActivityPriceRow[];
      if (selected.length !== input.activityIds.length) {
        throw new RegistrationError("activity_unavailable", "Одна из выбранных услуг больше недоступна. Обновите страницу и выберите снова.");
      }
    }

    // Участие обязательно и берётся из БД (клиент сумму не передаёт); услуги — только выбранные.
    const eventPrice = event.price_kopecks ?? 0;
    const total =
      eventPrice + selected.reduce((sum, activity) => sum + (activity.pricing_type === "fixed" ? (activity.fixed_price_kopecks ?? 0) : 0), 0);
    const publicId = randomUUID();
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO registrations (public_id, event_id, full_name, phone, messenger, event_price_kopecks, fixed_total_kopecks)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(publicId, eventId, input.fullName, input.phone, input.messenger, eventPrice, total);

    const insertSnapshot = db.prepare(
      `INSERT INTO registration_activities (registration_id, activity_id, activity_title_snapshot, pricing_type_snapshot,
         fixed_price_kopecks_snapshot, price_suffix_snapshot, start_time_snapshot, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const [index, activity] of selected.entries()) {
      insertSnapshot.run(
        lastInsertRowid,
        activity.id,
        activity.title,
        activity.pricing_type,
        activity.fixed_price_kopecks,
        activity.price_suffix,
        activity.start_time,
        index + 1,
      );
    }
    // Запись outbox — в той же транзакции: уведомление не потеряется, даже если процесс остановится.
    if (options.enqueueTelegram) enqueueRegistrationNotification(db, Number(lastInsertRowid));
    return getRegistrationByPublicId(db, publicId)!;
  })();
}

function attachActivities(db: Database.Database, rows: RegistrationRow[]): RegistrationWithActivities[] {
  if (!rows.length) return [];
  const placeholders = rows.map(() => "?").join(",");
  const snapshots = db
    .prepare(
      `SELECT registration_id, activity_id, activity_title_snapshot, pricing_type_snapshot, fixed_price_kopecks_snapshot,
         price_suffix_snapshot, start_time_snapshot
       FROM registration_activities WHERE registration_id IN (${placeholders}) ORDER BY position, id`,
    )
    .all(...rows.map((row) => row.id)) as (RegistrationActivitySnapshot & { registration_id: number })[];
  return rows.map((row) => ({
    ...row,
    activities: snapshots
      .filter((snapshot) => snapshot.registration_id === row.id)
      .map(({ registration_id: _registrationId, ...snapshot }) => {
        void _registrationId;
        return snapshot;
      }),
  }));
}

export function getRegistrationByPublicId(db: Database.Database, publicId: string): RegistrationWithActivities | null {
  const row = db.prepare("SELECT * FROM registrations WHERE public_id = ?").get(publicId) as RegistrationRow | undefined;
  return row ? attachActivities(db, [row])[0] : null;
}

const normalizeSearch = (value: string) => value.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").trim();

/**
 * Регистрации мероприятия, новые сверху. Поиск по ФИО (без учёта регистра и «ё»)
 * и по цифрам телефона выполняется в приложении: встроенный LIKE в SQLite не понимает регистр кириллицы.
 */
export function listRegistrations(db: Database.Database, eventId: number, query = ""): RegistrationWithActivities[] {
  const rows = db.prepare("SELECT * FROM registrations WHERE event_id = ? ORDER BY created_at DESC, id DESC").all(eventId) as RegistrationRow[];
  const text = normalizeSearch(query);
  const digits = query.replace(/\D/g, "");
  const filtered = text
    ? rows.filter(
        (row) =>
          normalizeSearch(row.full_name).includes(text) || (digits.length >= 3 && row.phone.replace(/\D/g, "").includes(digits)),
      )
    : rows;
  return attachActivities(db, filtered);
}

export function countRegistrations(db: Database.Database, eventId: number): number {
  return (db.prepare("SELECT COUNT(*) AS count FROM registrations WHERE event_id = ?").get(eventId) as { count: number }).count;
}

/** Удаляет все регистрации мероприятия (snapshots — каскадно). Мероприятие и услуги остаются. */
export function deleteRegistrationsForEvent(db: Database.Database, eventId: number): number {
  return db.transaction(() => db.prepare("DELETE FROM registrations WHERE event_id = ?").run(eventId).changes)();
}
