import "./load-env.mjs";
import { openDatabase, pendingMigrations, resolveDatabasePath } from "../db/migrator.mjs";
import { DEMO_EVENT_SLUG, seedDemo } from "../db/seed.mjs";

const filePath = resolveDatabasePath();
const db = openDatabase(filePath);
try {
  const pending = pendingMigrations(db);
  if (pending.length) {
    console.error(`Сначала выполните npm run db:migrate. Не применены: ${pending.join(", ")}`);
    process.exitCode = 1;
  } else {
    const result = seedDemo(db);
    console.log(`База: ${filePath}`);
    console.log(`Демо-мероприятие /event/${DEMO_EVENT_SLUG}: ${result.event === "created" ? "создано" : "уже существует"}.`);
    console.log(`Общие настройки: ${result.settings === "updated" ? "заполнены демо-значениями" : "не изменены"}.`);
  }
} finally {
  db.close();
}
