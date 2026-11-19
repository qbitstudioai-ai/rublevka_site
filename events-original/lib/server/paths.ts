import path from "node:path";

/** Каталог загруженных файлов (UPLOADS_DIR, по умолчанию data/uploads). Без тяжёлых зависимостей. */
export function uploadsDir() {
  const value = process.env.UPLOADS_DIR?.trim();
  return path.resolve(value ? value : path.join("data", "uploads"));
}
