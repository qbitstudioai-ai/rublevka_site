// Проверка состояния для /api/health. Не отправляет Telegram и не раскрывает пути или ошибки.
import Database from "better-sqlite3";
import fs from "node:fs";
import { MIGRATIONS_DIR, pendingMigrations } from "../../db/migrator.mjs";

/**
 * database   — файл SQLite открывается и отвечает на запрос;
 * migrations — все миграции применены;
 * uploads    — каталог загрузок существует (создаётся при необходимости) и доступен на запись.
 */
export function checkHealth({ databasePath, uploadsDir, migrationsDir = MIGRATIONS_DIR }) {
  const checks = { database: "error", migrations: "error", uploads: "error" };

  let db;
  try {
    // Только чтение и без создания файла: health не должен создавать пустую базу.
    db = new Database(databasePath, { readonly: true, fileMustExist: true });
    db.prepare("SELECT 1").get();
    checks.database = "ok";
    checks.migrations = pendingMigrations(db, migrationsDir).length ? "pending" : "ok";
  } catch {
    // Подробности не раскрываются наружу.
  } finally {
    try {
      db?.close();
    } catch {
      // ignore
    }
  }

  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
    if (!fs.statSync(uploadsDir).isDirectory()) throw new Error("not a directory");
    fs.accessSync(uploadsDir, fs.constants.R_OK | fs.constants.W_OK);
    checks.uploads = "ok";
  } catch {
    // ignore
  }

  const status = Object.values(checks).every((value) => value === "ok") ? "ok" : "degraded";
  return { status, checks };
}
