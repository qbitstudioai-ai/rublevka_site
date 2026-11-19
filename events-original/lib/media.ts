/**
 * Ссылка на изображение в БД бывает трёх видов:
 * - `upload:<uuid>.<ext>` — файл, загруженный через админпанель (лежит в UPLOADS_DIR);
 * - `/путь` — статический файл из `public/` (демо-QR);
 * - `https://…` — внешний адрес (демо-фотографии из seed).
 */
export const UPLOAD_REF_PREFIX = "upload:";
export const UPLOAD_NAME_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|png)$/;

export const isUploadRef = (ref: string | null | undefined): boolean =>
  !!ref && ref.startsWith(UPLOAD_REF_PREFIX) && UPLOAD_NAME_PATTERN.test(ref.slice(UPLOAD_REF_PREFIX.length));

/** Преобразует ссылку из БД в URL для браузера. */
export function mediaUrl(ref: string | null | undefined): string | null {
  if (!ref) return null;
  if (isUploadRef(ref)) return `/meropriyatiya/media/${ref.slice(UPLOAD_REF_PREFIX.length)}`;
  if (ref.startsWith("https://")) return ref;
  if (ref.startsWith("/") && !ref.startsWith("//")) return "/meropriyatiya" + ref;
  return null;
}
