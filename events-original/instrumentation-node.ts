import { validateEnvironment } from "./lib/server/env-check.mjs";
import { closeDb } from "./lib/server/db";

export async function onServerStart() {
  const { errors, warnings } = validateEnvironment();
  for (const warning of warnings) console.warn(`[config] ${warning}`);
  if (errors.length) {
    for (const error of errors) console.error(`[config] ${error}`);
    if (process.env.NODE_ENV === "production") {
      console.error("[config] Запуск остановлен: исправьте переменные окружения (см. DEPLOYMENT.md).");
      process.exit(1);
    }
  }

  // Next.js сам обрабатывает SIGTERM/SIGINT и завершает процесс через process.exit.
  // Перед выходом закрываем SQLite: WAL сбрасывается в основной файл. Незавершённые
  // Telegram-уведомления остаются в outbox (pending) и будут отправлены после запуска.
  process.once("exit", closeDb);
}
