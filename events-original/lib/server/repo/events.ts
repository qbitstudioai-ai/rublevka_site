import type Database from "better-sqlite3";
import type { EventInput, EventStatus, HeroFit } from "../validation";

/** Доступ к таблице events. Все запросы — prepared statements с параметрами. */

export type EventRow = {
  id: number;
  slug: string;
  title: string;
  event_date: string;
  start_time: string;
  /** Только у многодневных мероприятий; окончание в тот же день — NULL. */
  end_date: string | null;
  end_time: string | null;
  short_description: string;
  location_text: string | null;
  hero_image: string | null;
  /** cover — фото заполняет рамку; contain — фото целиком (афиши, вертикальные). */
  hero_fit: HeroFit;
  /** Стоимость участия в копейках; NULL — участие бесплатное. */
  price_kopecks: number | null;
  /** Текст блока «Дополнительно» на странице регистрации; '' — блока нет. */
  extra_info: string;
  /** Подробное описание — свиток «Подробнее» в шапке; '' — свитка нет. */
  long_description: string;
  status: EventStatus;
  created_at: string;
  updated_at: string;
};

export type EventListRow = EventRow & { registrations_count: number };

export class SlugTakenError extends Error {
  constructor() {
    super("Такой slug уже используется другим мероприятием.");
  }
}

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

const isUniqueSlugViolation = (error: unknown) =>
  error instanceof Error && "code" in error && error.code === "SQLITE_CONSTRAINT_UNIQUE" && error.message.includes("events.slug");

export function listEventsWithCounts(db: Database.Database): EventListRow[] {
  return db
    .prepare(
      `SELECT e.*, (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id) AS registrations_count
       FROM events e
       ORDER BY CASE e.status WHEN 'archived' THEN 1 ELSE 0 END, e.event_date DESC, e.id DESC`,
    )
    .all() as EventListRow[];
}

export function getEventById(db: Database.Database, id: number): EventRow | null {
  return (db.prepare("SELECT * FROM events WHERE id = ?").get(id) as EventRow | undefined) ?? null;
}

/** Публично доступно только опубликованное мероприятие. */
export function getPublishedEventBySlug(db: Database.Database, slug: string): EventRow | null {
  return (db.prepare("SELECT * FROM events WHERE slug = ? AND status = 'published'").get(slug) as EventRow | undefined) ?? null;
}

/**
 * Публичный список мероприятий: опубликованные, с датой не раньше сегодняшней, ближайшие первыми.
 * Черновики, архив и прошедшие мероприятия в список не попадают.
 */
export function listUpcomingPublishedEvents(db: Database.Database, today: string): EventRow[] {
  return db
    .prepare("SELECT * FROM events WHERE status = 'published' AND event_date >= ? ORDER BY event_date ASC, start_time ASC, id ASC")
    .all(today) as EventRow[];
}

export function createEvent(db: Database.Database, input: EventInput, heroImage: string | null): number {
  try {
    const result = db
      .prepare(
        `INSERT INTO events (slug, title, event_date, start_time, end_date, end_time, short_description, location_text, hero_image, hero_fit, price_kopecks, extra_info, long_description, status)
         VALUES (@slug, @title, @eventDate, @startTime, @endDate, @endTime, @shortDescription, @locationText, @heroImage, @heroFit, @priceKopecks, @extraInfo, @longDescription, @status)`,
      )
      .run({ ...input, heroImage });
    return Number(result.lastInsertRowid);
  } catch (error) {
    if (isUniqueSlugViolation(error)) throw new SlugTakenError();
    throw error;
  }
}

/**
 * Обновляет мероприятие. Slug меняется только явным вводом администратора —
 * при смене названия он не пересчитывается.
 * `heroImage: undefined` — оставить текущее фото.
 * Возвращает прежнее hero-фото, если оно заменено (для очистки файлов после commit).
 */
export function updateEvent(db: Database.Database, id: number, input: EventInput, heroImage: string | null | undefined) {
  const current = getEventById(db, id);
  if (!current) return null;
  const nextHero = heroImage === undefined ? current.hero_image : heroImage;
  try {
    db.prepare(
      `UPDATE events SET slug = @slug, title = @title, event_date = @eventDate, start_time = @startTime,
         end_date = @endDate, end_time = @endTime,
         short_description = @shortDescription, location_text = @locationText, hero_image = @heroImage,
         hero_fit = @heroFit, price_kopecks = @priceKopecks, extra_info = @extraInfo, long_description = @longDescription, status = @status, updated_at = ${NOW}
       WHERE id = @id`,
    ).run({ ...input, heroImage: nextHero, id });
  } catch (error) {
    if (isUniqueSlugViolation(error)) throw new SlugTakenError();
    throw error;
  }
  return { replacedHero: current.hero_image !== nextHero ? current.hero_image : null };
}

export function setEventStatus(db: Database.Database, id: number, status: EventStatus) {
  return db.prepare(`UPDATE events SET status = ?, updated_at = ${NOW} WHERE id = ?`).run(status, id).changes > 0;
}

/** Все ссылки на изображения мероприятия: hero, карточки и галереи услуг. */
export function collectEventImageRefs(db: Database.Database, id: number): string[] {
  const rows = db
    .prepare(
      `SELECT hero_image AS ref FROM events WHERE id = @id
       UNION ALL SELECT card_image FROM activities WHERE event_id = @id
       UNION ALL SELECT ai.image_path FROM activity_images ai JOIN activities a ON a.id = ai.activity_id WHERE a.event_id = @id`,
    )
    .all({ id }) as { ref: string | null }[];
  return rows.map((row) => row.ref).filter((ref): ref is string => !!ref);
}

/**
 * Полное удаление мероприятия. Услуги, галереи, регистрации и snapshots удаляются каскадно
 * в одной транзакции. Возвращает ссылки на изображения для очистки файлов после commit.
 */
export function deleteEvent(db: Database.Database, id: number): { deleted: boolean; imageRefs: string[] } {
  return db.transaction(() => {
    const imageRefs = collectEventImageRefs(db, id);
    const deleted = db.prepare("DELETE FROM events WHERE id = ?").run(id).changes > 0;
    return { deleted, imageRefs: deleted ? imageRefs : [] };
  })();
}
