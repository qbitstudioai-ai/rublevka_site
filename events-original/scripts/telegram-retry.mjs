// Повторная отправка Telegram-уведомлений из outbox. Предназначен для cron:
//   npm run telegram:retry                    — ожидающие (pending)
//   npm run telegram:retry -- --include-failed — также исчерпавшие попытки
//   npm run telegram:retry -- --limit=50       — размер пачки (по умолчанию 20)
// Токен бота не выводится.
import "./load-env.mjs";
import { openDatabase, pendingMigrations, resolveDatabasePath } from "../db/migrator.mjs";
import { readTelegramConfig } from "../lib/server/telegram.mjs";
import { outboxStats, processPendingTelegramNotifications } from "../lib/server/telegram-outbox.mjs";

const args = process.argv.slice(2);
const includeFailed = args.includes("--include-failed");
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

const config = readTelegramConfig();
if (!config) {
  console.error("Telegram не настроен: задайте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID.");
  process.exit(1);
}

const db = openDatabase(resolveDatabasePath());
try {
  const pending = pendingMigrations(db);
  if (pending.length) {
    console.error(`Сначала выполните npm run db:migrate. Не применены: ${pending.join(", ")}`);
    process.exitCode = 1;
  } else {
    const summary = await processPendingTelegramNotifications(db, config, { includeFailed, limit, log: () => undefined });
    const stats = outboxStats(db);
    console.log(
      `Обработано: ${summary.processed}. Отправлено: ${summary.sent}. Будет повтор: ${summary.retry}. Исчерпали попытки: ${summary.failed}.`,
    );
    console.log(`В очереди: ожидают ${stats.pending}, не удалось после попыток ${stats.failed}.`);
    if (summary.retry + summary.failed > 0) process.exitCode = 2;
  }
} finally {
  db.close();
}
