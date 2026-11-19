import type Database from "better-sqlite3";
import type { PricingType } from "../../money";
import type { ActivityInput } from "../validation";

export type ActivityRow = {
  id: number;
  event_id: number;
  title: string;
  short_description: string;
  long_description: string;
  start_time: string | null;
  duration_text: string | null;
  pricing_type: PricingType;
  fixed_price_kopecks: number | null;
  price_suffix: string | null;
  card_image: string | null;
  details: string;
  sort_order: number;
  is_active: 0 | 1;
  created_at: string;
  updated_at: string;
};

export type ActivityImageRow = {
  id: number;
  activity_id: number;
  image_path: string;
  alt_text: string;
  sort_order: number;
};

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

export const parseDetails = (json: string): string[] => {
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};

export function listActivities(db: Database.Database, eventId: number, options: { activeOnly?: boolean } = {}): ActivityRow[] {
  const sql = `SELECT * FROM activities WHERE event_id = ? ${options.activeOnly ? "AND is_active = 1" : ""} ORDER BY sort_order, id`;
  return db.prepare(sql).all(eventId) as ActivityRow[];
}

export function getActivity(db: Database.Database, eventId: number, activityId: number): ActivityRow | null {
  return (db.prepare("SELECT * FROM activities WHERE id = ? AND event_id = ?").get(activityId, eventId) as ActivityRow | undefined) ?? null;
}

export function listGallery(db: Database.Database, activityIds: number[]): ActivityImageRow[] {
  if (!activityIds.length) return [];
  const placeholders = activityIds.map(() => "?").join(",");
  return db
    .prepare(`SELECT * FROM activity_images WHERE activity_id IN (${placeholders}) ORDER BY activity_id, sort_order, id`)
    .all(...activityIds) as ActivityImageRow[];
}

type GalleryChanges = {
  /** Новые изображения галереи (уже сохранённые файлы). */
  add: string[];
  /** id изображений галереи, которые нужно удалить. */
  removeIds: number[];
};

function addGalleryImages(db: Database.Database, activityId: number, title: string, refs: string[]) {
  const { maxOrder } = db.prepare("SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM activity_images WHERE activity_id = ?").get(activityId) as {
    maxOrder: number;
  };
  const insert = db.prepare("INSERT INTO activity_images (activity_id, image_path, alt_text, sort_order) VALUES (?, ?, ?, ?)");
  refs.forEach((ref, index) => insert.run(activityId, ref, `${title}, фотография`, maxOrder + index + 1));
}

const activityParams = (input: ActivityInput) => ({
  title: input.title,
  shortDescription: input.shortDescription,
  longDescription: input.longDescription,
  startTime: input.startTime,
  durationText: input.durationText,
  pricingType: input.pricingType,
  fixedPriceKopecks: input.fixedPriceKopecks,
  priceSuffix: input.priceSuffix,
  details: JSON.stringify(input.details),
  isActive: input.isActive ? 1 : 0,
});

/** Создаёт услугу в конце списка мероприятия. */
export function createActivity(db: Database.Database, eventId: number, input: ActivityInput, cardImage: string | null, gallery: string[]) {
  return db.transaction(() => {
    const { maxOrder } = db.prepare("SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM activities WHERE event_id = ?").get(eventId) as {
      maxOrder: number;
    };
    const result = db
      .prepare(
        `INSERT INTO activities (event_id, title, short_description, long_description, start_time, duration_text, pricing_type,
           fixed_price_kopecks, price_suffix, card_image, details, sort_order, is_active)
         VALUES (@eventId, @title, @shortDescription, @longDescription, @startTime, @durationText, @pricingType,
           @fixedPriceKopecks, @priceSuffix, @cardImage, @details, @sortOrder, @isActive)`,
      )
      .run({ ...activityParams(input), eventId, cardImage, sortOrder: maxOrder + 1 });
    const id = Number(result.lastInsertRowid);
    addGalleryImages(db, id, input.title, gallery);
    return id;
  })();
}

/**
 * Обновляет услугу и галерею в одной транзакции.
 * `cardImage: undefined` — оставить текущее фото.
 * Возвращает ссылки на заменённые/удалённые изображения для очистки после commit.
 */
export function updateActivity(
  db: Database.Database,
  eventId: number,
  activityId: number,
  input: ActivityInput,
  cardImage: string | null | undefined,
  gallery: GalleryChanges,
): { removedRefs: string[] } | null {
  return db.transaction(() => {
    const current = getActivity(db, eventId, activityId);
    if (!current) return null;
    const nextCard = cardImage === undefined ? current.card_image : cardImage;
    db.prepare(
      `UPDATE activities SET title = @title, short_description = @shortDescription, long_description = @longDescription,
         start_time = @startTime, duration_text = @durationText, pricing_type = @pricingType,
         fixed_price_kopecks = @fixedPriceKopecks, price_suffix = @priceSuffix, card_image = @cardImage,
         details = @details, is_active = @isActive, updated_at = ${NOW}
       WHERE id = @id AND event_id = @eventId`,
    ).run({ ...activityParams(input), cardImage: nextCard, id: activityId, eventId });

    const removedRefs: string[] = [];
    if (current.card_image && current.card_image !== nextCard) removedRefs.push(current.card_image);

    // Удаляются только изображения именно этой услуги.
    const selectImage = db.prepare("SELECT image_path FROM activity_images WHERE id = ? AND activity_id = ?");
    const deleteImage = db.prepare("DELETE FROM activity_images WHERE id = ? AND activity_id = ?");
    for (const imageId of gallery.removeIds) {
      const row = selectImage.get(imageId, activityId) as { image_path: string } | undefined;
      if (row && deleteImage.run(imageId, activityId).changes) removedRefs.push(row.image_path);
    }
    addGalleryImages(db, activityId, input.title, gallery.add);
    return { removedRefs };
  })();
}

export function setActivityActive(db: Database.Database, eventId: number, activityId: number, active: boolean) {
  return (
    db
      .prepare(`UPDATE activities SET is_active = ?, updated_at = ${NOW} WHERE id = ? AND event_id = ?`)
      .run(active ? 1 : 0, activityId, eventId).changes > 0
  );
}

/** Меняет услугу местами с соседней (вверх/вниз) внутри мероприятия. */
export function moveActivity(db: Database.Database, eventId: number, activityId: number, direction: "up" | "down") {
  return db.transaction(() => {
    const ordered = listActivities(db, eventId);
    const index = ordered.findIndex((activity) => activity.id === activityId);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= ordered.length) return false;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    // Перенумеровываем подряд, чтобы порядок был однозначным даже при совпадающих sort_order.
    const update = db.prepare("UPDATE activities SET sort_order = ? WHERE id = ?");
    ordered.forEach((activity, position) => update.run(position + 1, activity.id));
    return true;
  })();
}

/**
 * Удаляет услугу и её галерею. Snapshots в регистрациях сохраняются (activity_id станет NULL).
 * Возвращает ссылки на изображения для очистки после commit.
 */
export function deleteActivity(db: Database.Database, eventId: number, activityId: number): { deleted: boolean; imageRefs: string[] } {
  return db.transaction(() => {
    const current = getActivity(db, eventId, activityId);
    if (!current) return { deleted: false, imageRefs: [] };
    const gallery = listGallery(db, [activityId]).map((image) => image.image_path);
    db.prepare("DELETE FROM activities WHERE id = ? AND event_id = ?").run(activityId, eventId);
    return { deleted: true, imageRefs: [current.card_image, ...gallery].filter((ref): ref is string => !!ref) };
  })();
}
