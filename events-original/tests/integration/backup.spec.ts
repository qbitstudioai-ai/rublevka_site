import { expect, test } from "@playwright/test";
import Database from "better-sqlite3";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { applyRetention, backupFileName, createBackup, listBackups } from "@/db/backup.mjs";
import { openDatabase, runMigrations } from "@/db/migrator.mjs";
import { seedDemo } from "@/db/seed.mjs";
import { tempDir } from "./helpers";

/** Минимальное чтение tar.gz для проверки содержимого архива. */
function readTarGz(file: string) {
  const data = zlib.gunzipSync(fs.readFileSync(file));
  const entries = new Map<string, Buffer>();
  let offset = 0;
  while (offset + 512 <= data.length) {
    const header = data.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    const size = parseInt(header.subarray(124, 136).toString("utf8").replace(/\0.*$/, "").trim() || "0", 8);
    const type = String.fromCharCode(header[156]);
    offset += 512;
    if (type === "0") entries.set(name, data.subarray(offset, offset + size));
    offset += Math.ceil(size / 512) * 512;
  }
  return entries;
}

const UPLOAD_A = "11111111-1111-4111-8111-111111111111.webp";
const UPLOAD_B = "22222222-2222-4222-8222-222222222222.png";

function setupApp() {
  const root = tempDir("backup-app-");
  const databasePath = path.join(root, "data", "rublevka.sqlite");
  const uploadsDir = path.join(root, "data", "uploads");
  const backupDir = path.join(root, "backups");
  const db = openDatabase(databasePath);
  runMigrations(db);
  seedDemo(db);
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.writeFileSync(path.join(uploadsDir, UPLOAD_A), "image-a");
  fs.writeFileSync(path.join(uploadsDir, UPLOAD_B), "image-b");
  fs.writeFileSync(path.join(uploadsDir, "notes.txt"), "посторонний файл");
  // Секреты и код рядом с данными не должны попасть в архив.
  fs.writeFileSync(path.join(root, ".env"), "ADMIN_PASSWORD=secret-value-123");
  fs.mkdirSync(path.join(root, "node_modules"));
  return { root, db, databasePath, uploadsDir, backupDir };
}

test.describe("резервное копирование", () => {
  test("архив содержит согласованную БД (включая WAL), uploads и не содержит лишнего", async () => {
    const { db, databasePath, uploadsDir, backupDir } = setupApp();
    // Запись остаётся только в WAL: автоматический checkpoint выключен, соединение открыто.
    db.pragma("wal_autocheckpoint = 0");
    db.prepare(
      "INSERT INTO registrations (public_id, event_id, full_name, phone, messenger, fixed_total_kopecks) VALUES ('wal-only', 1, 'Иванов Иван', '+79000000000', NULL, 0)",
    ).run();
    expect(fs.statSync(`${databasePath}-wal`).size).toBeGreaterThan(0);

    const result = await createBackup({ databasePath, uploadsDir, backupDir, now: new Date("2026-10-16T17:59:03Z") });
    expect(result.fileName).toBe("rublevka-backup-20261016-175903Z.tar.gz");
    expect(fs.readdirSync(backupDir)).toEqual([result.fileName]);
    expect(result.manifest).toMatchObject({ database: { registrations: 1, events: 1 }, uploads: { files: 2 } });

    const entries = readTarGz(result.file);
    expect([...entries.keys()].sort()).toEqual(["database/rublevka.sqlite", "manifest.json", `uploads/${UPLOAD_A}`, `uploads/${UPLOAD_B}`]);
    expect(entries.get(`uploads/${UPLOAD_A}`)?.toString()).toBe("image-a");
    for (const name of entries.keys()) expect(name).not.toMatch(/\.env|node_modules|notes\.txt|\.ts$/);

    // База из архива открывается и содержит регистрацию из WAL.
    const restored = path.join(tempDir("restore-"), "restored.sqlite");
    fs.writeFileSync(restored, entries.get("database/rublevka.sqlite")!);
    const copy = new Database(restored, { readonly: true });
    expect(copy.pragma("integrity_check", { simple: true })).toBe("ok");
    expect(copy.pragma("journal_mode", { simple: true })).toBe("delete");
    expect(copy.prepare("SELECT full_name FROM registrations WHERE public_id = 'wal-only'").get()).toEqual({ full_name: "Иванов Иван" });
    expect(copy.prepare("SELECT COUNT(*) AS c FROM schema_migrations").get()).toEqual({ c: 9 });
    copy.close();
    db.close();

    // Формат совместим со стандартным tar (если он есть в системе).
    const tar = spawnSync("tar", ["-tzf", result.fileName], { cwd: backupDir, encoding: "utf8" });
    if (tar.status === 0) expect(tar.stdout).toContain("database/rublevka.sqlite");
  });

  test("retention удаляет только собственные старые архивы", async () => {
    const { db, databasePath, uploadsDir, backupDir } = setupApp();
    db.close();
    const now = new Date("2026-10-16T03:00:00Z");
    fs.mkdirSync(backupDir, { recursive: true });
    const old = backupFileName(new Date("2026-09-01T03:00:00Z"));
    const recent = backupFileName(new Date("2026-10-10T03:00:00Z"));
    const foreign = [
      "rublevka-backup-old.tar.gz",
      "other-app-backup-20200101-000000Z.tar.gz",
      "rublevka-backup-20200101-000000Z.tar.gz.partial",
      "important.sqlite",
    ];
    for (const name of [old, recent, ...foreign]) fs.writeFileSync(path.join(backupDir, name), "x");
    fs.mkdirSync(path.join(backupDir, "rublevka-backup-20200101-000000Z.tar.gz-dir"));

    const created = await createBackup({ databasePath, uploadsDir, backupDir, now });
    const deleted = applyRetention({ backupDir, retentionDays: 30, now, keep: created.fileName });

    expect(deleted).toEqual([old]);
    const remaining = fs.readdirSync(backupDir).sort();
    expect(remaining).toEqual([...foreign, recent, created.fileName, "rublevka-backup-20200101-000000Z.tar.gz-dir"].sort());
    expect(listBackups(backupDir).map((backup) => backup.name)).toEqual([created.fileName, recent]);
    expect(() => applyRetention({ backupDir, retentionDays: 0 })).toThrow();
  });

  test("CLI npm run backup: требует BACKUP_DIR, создаёт архив, не печатает секреты", () => {
    const { db, databasePath, uploadsDir, backupDir } = setupApp();
    db.close();
    const env = { ...process.env, DATABASE_PATH: databasePath, UPLOADS_DIR: uploadsDir, ADMIN_PASSWORD: "secret-value-123" };

    const missing = spawnSync(process.execPath, [path.join("scripts", "backup.mjs")], { env: { ...env, BACKUP_DIR: "" }, encoding: "utf8" });
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("BACKUP_DIR");

    const output = execFileSync(process.execPath, [path.join("scripts", "backup.mjs")], {
      env: { ...env, BACKUP_DIR: backupDir, BACKUP_RETENTION_DAYS: "30" },
      encoding: "utf8",
    });
    expect(output).toMatch(/Резервная копия: rublevka-backup-\d{8}-\d{6}Z\.tar\.gz/);
    expect(output).toContain("файлов: 2");
    expect(output).not.toContain("secret-value-123");
    expect(listBackups(backupDir)).toHaveLength(1);
  });
});
