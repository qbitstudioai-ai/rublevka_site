import type Database from "better-sqlite3";
import { openDatabase, pendingMigrations, resolveDatabasePath } from "../../db/migrator.mjs";

/**
 * Единственное подключение к SQLite на процесс сервера.
 * Схему приложение не создаёт: если миграции не применены, запрос завершается понятной ошибкой.
 */

const globalForDb = globalThis as unknown as { __rublevkaDb?: { path: string; db: Database.Database } };

export function getDb(): Database.Database {
  const filePath = resolveDatabasePath();
  const cached = globalForDb.__rublevkaDb;
  if (cached && cached.path === filePath) return cached.db;

  const db = openDatabase(filePath);
  const pending = pendingMigrations(db);
  if (pending.length) {
    db.close();
    throw new Error(`База данных ${filePath} не подготовлена. Выполните npm run db:migrate (ожидают: ${pending.join(", ")}).`);
  }
  globalForDb.__rublevkaDb = { path: filePath, db };
  return db;
}

/** Закрывает подключение при остановке процесса (синхронно, подходит для события exit). */
export function closeDb() {
  const cached = globalForDb.__rublevkaDb;
  if (!cached) return;
  globalForDb.__rublevkaDb = undefined;
  try {
    cached.db.close();
  } catch {
    // Процесс и так завершается.
  }
}
