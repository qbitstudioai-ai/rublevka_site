// Готовит чистую БД для e2e-тестов: удаляет прошлые данные, применяет миграции и seed.
import fs from "node:fs";
import path from "node:path";
import { openDatabase, runMigrations } from "../db/migrator.mjs";
import { DEMO_EVENT_SLUG, seedDemo } from "../db/seed.mjs";
import { APP_TIME_ZONE } from "../lib/shared/format-core.mjs";

// fs.rmSync на Windows в пути с кириллицей может молча ничего не удалить,
// поэтому каталог очищается явно через unlinkSync/rmdirSync.
function removeDir(target) {
  if (!fs.existsSync(target)) return;
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const entryPath = path.join(target, entry.name);
    if (entry.isDirectory()) removeDir(entryPath);
    else fs.unlinkSync(entryPath);
  }
  fs.rmdirSync(target);
}

const dir = path.join(process.cwd(), ".e2e-data");
removeDir(dir);
if (fs.existsSync(dir)) throw new Error(`Не удалось очистить ${dir}`);
const db = openDatabase(path.join(dir, "e2e.sqlite"));
runMigrations(db);
seedDemo(db);
// Регистрация на прошедшее мероприятие закрыта, поэтому демо-мероприятие всегда через неделю
// от запуска тестов (по времени комплекса), а не на дату из seed. Тесты читают дату из БД.
const today = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: APP_TIME_ZONE }).format(new Date());
const demoDate = new Date(`${today}T00:00:00Z`);
demoDate.setUTCDate(demoDate.getUTCDate() + 7);
db.prepare("UPDATE events SET event_date = ? WHERE slug = ?").run(demoDate.toISOString().slice(0, 10), DEMO_EVENT_SLUG);
db.close();
console.log("E2E: чистая база подготовлена");
