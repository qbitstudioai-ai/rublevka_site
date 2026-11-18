// Управляемые SQL-миграции и подключение к SQLite.
// Используется CLI-скриптами (`npm run db:migrate`, `npm run db:seed`) и тестами.
// Приложение само миграции не выполняет — только проверяет, что схема актуальна.

import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");
export const DEFAULT_DATABASE_PATH = path.join("data", "rublevka.sqlite");

export function resolveDatabasePath(value = process.env.DATABASE_PATH) {
  return path.resolve(value && value.trim() ? value.trim() : DEFAULT_DATABASE_PATH);
}

/** Открывает БД с обязательными PRAGMA. */
export function openDatabase(filePath = resolveDatabasePath()) {
  fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(filePath), { recursive: true });
  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");
  return db;
}

export function listMigrationFiles(dir = MIGRATIONS_DIR) {
  return fs
    .readdirSync(/*turbopackIgnore: true*/ dir)
    .filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/.test(name))
    .sort();
}

const sha256 = (text) => createHash("sha256").update(text).digest("hex");
// Сумма не зависит от переводов строк: Git на Windows может хранить файл с CRLF.
const checksum = (sql) => sha256(sql.replace(/\r\n/g, "\n"));

function ensureMigrationsTable(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,
    checksum   TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`);
}

/**
 * Применяет новые миграции по порядку, каждую — в своей транзакции.
 * Уже применённые пропускаются; изменённый после применения файл — ошибка.
 */
export function runMigrations(db, dir = MIGRATIONS_DIR) {
  ensureMigrationsTable(db);
  const applied = new Map(db.prepare("SELECT version, checksum FROM schema_migrations").all().map((row) => [row.version, row.checksum]));
  const result = { applied: [], skipped: [] };

  for (const file of listMigrationFiles(dir)) {
    const filePath = path.join(/*turbopackIgnore: true*/ dir, file);
    const sql = fs.readFileSync(/*turbopackIgnore: true*/ filePath, "utf8");
    const sum = checksum(sql);
    if (applied.has(file)) {
      // Ранее суммы считались по «сырым» байтам файла — их тоже признаём.
      const stored = applied.get(file);
      if (stored !== sum && stored !== sha256(sql)) {
        throw new Error(`Миграция ${file} изменена после применения. Создайте новую миграцию вместо правки старой.`);
      }
      result.skipped.push(file);
      continue;
    }
    // Миграциям, которые пересоздают таблицы, нужны выключенные внешние ключи —
    // иначе DROP TABLE каскадно удалит связанные строки. PRAGMA действует только вне транзакции,
    // а целостность проверяется foreign_key_check перед commit.
    const foreignKeysOff = /^--\s*migrate:foreign_keys=off\s*$/m.test(sql);
    if (foreignKeysOff) db.pragma("foreign_keys = OFF");
    try {
      db.transaction(() => {
        db.exec(sql);
        if (foreignKeysOff) {
          const violations = db.pragma("foreign_key_check");
          if (violations.length) throw new Error(`Миграция ${file} нарушает внешние ключи: ${JSON.stringify(violations.slice(0, 5))}`);
        }
        db.prepare("INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)").run(file, sum);
      })();
    } finally {
      if (foreignKeysOff) db.pragma("foreign_keys = ON");
    }
    result.applied.push(file);
  }
  return result;
}

/** Возвращает список неприменённых миграций (пустой — схема актуальна). */
export function pendingMigrations(db, dir = MIGRATIONS_DIR) {
  const hasTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'").get();
  const files = listMigrationFiles(dir);
  if (!hasTable) return files;
  const applied = new Set(db.prepare("SELECT version FROM schema_migrations").all().map((row) => row.version));
  return files.filter((file) => !applied.has(file));
}
