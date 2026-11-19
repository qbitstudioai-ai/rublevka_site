import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { openDatabase, runMigrations } from "@/db/migrator.mjs";
import { tempDir } from "./helpers";

test("контрольная сумма миграции не зависит от переводов строк (LF/CRLF)", () => {
  const dir = tempDir();
  const migrations = path.join(dir, "migrations");
  fs.mkdirSync(migrations);
  const file = path.join(migrations, "001_test.sql");
  fs.writeFileSync(file, "CREATE TABLE t (id INTEGER);\nCREATE TABLE u (id INTEGER);\n");
  const db = openDatabase(path.join(dir, "db.sqlite"));
  expect(runMigrations(db, migrations).applied).toEqual(["001_test.sql"]);

  // Git на Windows может пересохранить файл с CRLF — это не изменение миграции.
  fs.writeFileSync(file, "CREATE TABLE t (id INTEGER);\r\nCREATE TABLE u (id INTEGER);\r\n");
  expect(runMigrations(db, migrations).skipped).toEqual(["001_test.sql"]);

  // Реальное изменение по-прежнему обнаруживается.
  fs.writeFileSync(file, "CREATE TABLE t (id INTEGER, name TEXT);\n");
  expect(() => runMigrations(db, migrations)).toThrow(/изменена после применения/);
  db.close();
});
