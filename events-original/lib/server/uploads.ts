import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { isUploadRef, UPLOAD_NAME_PATTERN, UPLOAD_REF_PREFIX } from "../media";
import { uploadsDir } from "./paths";

/**
 * Локальное хранилище загруженных изображений.
 * - Имя файла всегда генерируется сервером (UUID), исходное имя не используется.
 * - Формат определяется по содержимому (sharp), а не по расширению или MIME из браузера.
 * - Фотографии уменьшаются и перекодируются в WebP; QR сохраняются без потерь в PNG.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_INPUT_PIXELS = 50_000_000;

export type UploadKind = "photo" | "qr";

export class UploadError extends Error {}

export { uploadsDir };

/** Безопасно превращает имя файла в путь внутри UPLOADS_DIR; иначе — null. */
export function resolveUploadPath(name: string): string | null {
  if (!UPLOAD_NAME_PATTERN.test(name)) return null;
  const dir = uploadsDir();
  const filePath = path.resolve(dir, name);
  return path.dirname(filePath) === dir ? filePath : null;
}

/** Файл из FormData, если пользователь действительно его выбрал. */
export function pickFile(value: FormDataEntryValue | null): File | null {
  return value instanceof File && value.size > 0 ? value : null;
}

/** Проверяет, оптимизирует и сохраняет изображение. Возвращает ссылку `upload:<имя>`. */
export async function saveImage(file: File, kind: UploadKind): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("Файл больше 10 МБ. Уменьшите фотографию и попробуйте снова.");
  if (file.type && !ALLOWED_MIME.has(file.type)) throw new UploadError("Поддерживаются только JPEG, PNG и WebP.");

  const input = Buffer.from(await file.arrayBuffer());
  let output: Buffer;
  let extension: "webp" | "png";
  try {
    const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
    const metadata = await image.metadata();
    if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) throw new UploadError("Поддерживаются только JPEG, PNG и WebP.");
    if (kind === "photo") {
      output = await image.rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
      extension = "webp";
    } else {
      // QR нельзя сжимать с потерями: сохраняем PNG, ограничив только размер.
      output = await image.resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).png().toBuffer();
      extension = "png";
    }
  } catch (error) {
    if (error instanceof UploadError) throw error;
    throw new UploadError("Не удалось прочитать изображение. Загрузите JPEG, PNG или WebP.");
  }

  const name = `${randomUUID()}.${extension}`;
  const filePath = resolveUploadPath(name)!;
  await fs.mkdir(uploadsDir(), { recursive: true });
  await fs.writeFile(filePath, output, { flag: "wx" });
  return `${UPLOAD_REF_PREFIX}${name}`;
}

/** Удаляет файлы без проверки использования — для отката, если транзакция не удалась. */
export async function removeUploads(refs: (string | null | undefined)[]) {
  await Promise.all(
    refs.filter((ref): ref is string => isUploadRef(ref)).map(async (ref) => {
      const filePath = resolveUploadPath(ref.slice(UPLOAD_REF_PREFIX.length));
      if (!filePath) return;
      try {
        await fs.unlink(filePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }),
  );
}

/** Сколько записей БД ссылается на изображение. */
export function countUploadReferences(db: Database.Database, ref: string): number {
  const row = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM events WHERE hero_image = @ref) +
         (SELECT COUNT(*) FROM activities WHERE card_image = @ref) +
         (SELECT COUNT(*) FROM activity_images WHERE image_path = @ref) +
         (SELECT COUNT(*) FROM app_settings WHERE payment_qr_image = @ref OR community_qr_image = @ref) AS count`,
    )
    .get({ ref }) as { count: number };
  return row.count;
}

/**
 * Удаляет файлы, на которые больше никто не ссылается.
 * Вызывать только после успешного commit транзакции.
 */
export async function deleteOrphanUploads(db: Database.Database, refs: (string | null | undefined)[]) {
  const unique = [...new Set(refs.filter((ref): ref is string => isUploadRef(ref)))];
  const orphans = unique.filter((ref) => countUploadReferences(db, ref) === 0);
  await removeUploads(orphans);
  return orphans;
}
