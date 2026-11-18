// Резервное копирование: SQLite (через online backup API — учитывает WAL и не блокирует
// работающее приложение) + каталог загруженных изображений в одном архиве .tar.gz.
// Используется CLI `npm run backup` и тестами. Типы — в backup.d.mts.

import Database from "better-sqlite3";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { finished } from "node:stream/promises";
import zlib from "node:zlib";

export const BACKUP_NAME_PATTERN = /^rublevka-backup-(\d{8})-(\d{6})Z\.tar\.gz$/;
const UPLOAD_FILE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|png)$/;

/** 2026-10-16T17:59:03Z → 20261016-175903Z (UTC). */
export function backupStamp(date) {
  const [day, time] = date.toISOString().split("T");
  return `${day.replaceAll("-", "")}-${time.slice(0, 8).replaceAll(":", "")}Z`;
}

export function backupFileName(date) {
  return `rublevka-backup-${backupStamp(date)}.tar.gz`;
}

/** Момент создания из имени файла; null — файл не является бэкапом этого приложения. */
export function parseBackupDate(fileName) {
  const match = BACKUP_NAME_PATTERN.exec(fileName);
  if (!match) return null;
  const [d, t] = [match[1], match[2]];
  const date = new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Удаление каталога без fs.rmSync (на Windows в путях с кириллицей он может молча не сработать). */
export function removeDir(target) {
  if (!fs.existsSync(target)) return;
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const entryPath = path.join(target, entry.name);
    if (entry.isDirectory()) removeDir(entryPath);
    else fs.unlinkSync(entryPath);
  }
  fs.rmdirSync(target);
}

// ---------- Минимальный писатель tar (ustar) ----------

function tarHeader(name, size, mtime, type = "0") {
  const header = Buffer.alloc(512, 0);
  const put = (value, offset, length) => header.write(value, offset, length, "utf8");
  const octal = (value, length) => value.toString(8).padStart(length - 1, "0") + "\0";
  put(name, 0, 100);
  put(octal(type === "5" ? 0o755 : 0o644, 8), 100, 8);
  put(octal(0, 8), 108, 8);
  put(octal(0, 8), 116, 8);
  put(octal(size, 12), 124, 12);
  put(octal(Math.floor(mtime.getTime() / 1000), 12), 136, 12);
  put("        ", 148, 8);
  put(type, 156, 1);
  put("ustar\0", 257, 6);
  put("00", 263, 2);
  let sum = 0;
  for (const byte of header) sum += byte;
  put(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8);
  return header;
}

async function writeTarGz(outputFile, entries) {
  const gzip = zlib.createGzip({ level: 6 });
  const output = fs.createWriteStream(outputFile, { flags: "wx" });
  gzip.pipe(output);
  const write = async (chunk) => {
    if (!gzip.write(chunk)) await once(gzip, "drain");
  };
  for (const entry of entries) {
    if (entry.type === "dir") {
      await write(tarHeader(`${entry.name}/`, 0, entry.mtime, "5"));
      continue;
    }
    const data = entry.data ?? null;
    const size = data ? data.length : fs.statSync(entry.source).size;
    await write(tarHeader(entry.name, size, entry.mtime));
    let written = 0;
    if (data) {
      await write(data);
      written = data.length;
    } else {
      for await (const chunk of fs.createReadStream(entry.source)) {
        await write(chunk);
        written += chunk.length;
      }
    }
    if (written !== size) throw new Error(`Файл ${entry.name} изменился во время копирования`);
    const padding = (512 - (size % 512)) % 512;
    if (padding) await write(Buffer.alloc(padding, 0));
  }
  await write(Buffer.alloc(1024, 0));
  gzip.end();
  await finished(output);
}

// ---------- Резервная копия ----------

/**
 * Создаёт архив rublevka-backup-<UTC>.tar.gz в backupDir:
 *   manifest.json, database/rublevka.sqlite, uploads/<файлы>.
 * Файл сначала пишется как .partial и переименовывается только после успешного завершения.
 */
export async function createBackup({ databasePath, uploadsDir, backupDir, now = new Date() }) {
  if (!fs.existsSync(databasePath)) throw new Error("Файл базы данных не найден.");
  fs.mkdirSync(backupDir, { recursive: true });
  const fileName = backupFileName(now);
  const finalPath = path.join(backupDir, fileName);
  if (fs.existsSync(finalPath)) throw new Error(`Резервная копия ${fileName} уже существует.`);
  const staging = path.join(backupDir, `.rublevka-backup-tmp-${backupStamp(now)}-${process.pid}`);
  const partialPath = `${finalPath}.partial`;
  fs.mkdirSync(staging);

  try {
    // 1. Согласованный снимок БД (включая данные из WAL), не мешающий работе приложения.
    const stagedDb = path.join(staging, "rublevka.sqlite");
    const source = new Database(databasePath, { fileMustExist: true });
    try {
      source.pragma("busy_timeout = 10000");
      await source.backup(stagedDb);
    } finally {
      source.close();
    }

    // 2. Снимок — самодостаточный файл без -wal/-shm; проверяем целостность.
    const copy = new Database(stagedDb);
    let manifestDb;
    try {
      copy.pragma("journal_mode = DELETE");
      const integrity = copy.pragma("integrity_check", { simple: true });
      if (integrity !== "ok") throw new Error(`Проверка целостности копии не пройдена: ${integrity}`);
      const count = (table) => copy.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c;
      manifestDb = {
        migrations: copy.prepare("SELECT version FROM schema_migrations ORDER BY version").all().map((row) => row.version),
        events: count("events"),
        registrations: count("registrations"),
      };
    } finally {
      copy.close();
    }

    // 3. Загруженные изображения (только файлы приложения, без вложенных каталогов и ссылок).
    const uploads = fs.existsSync(uploadsDir)
      ? fs
          .readdirSync(uploadsDir, { withFileTypes: true })
          .filter((entry) => entry.isFile() && UPLOAD_FILE_PATTERN.test(entry.name))
          .map((entry) => entry.name)
          .sort()
      : [];

    const manifest = {
      app: "rublevka-guest-registration",
      format: 1,
      createdAt: now.toISOString(),
      database: { file: "database/rublevka.sqlite", ...manifestDb },
      uploads: { directory: "uploads", files: uploads.length },
    };

    await writeTarGz(partialPath, [
      { name: "manifest.json", data: Buffer.from(JSON.stringify(manifest, null, 2)), mtime: now },
      { name: "database", type: "dir", mtime: now },
      { name: "database/rublevka.sqlite", source: stagedDb, mtime: now },
      { name: "uploads", type: "dir", mtime: now },
      ...uploads.map((name) => ({ name: `uploads/${name}`, source: path.join(uploadsDir, name), mtime: now })),
    ]);
    fs.renameSync(partialPath, finalPath);
    return { file: finalPath, fileName, bytes: fs.statSync(finalPath).size, manifest };
  } catch (error) {
    if (fs.existsSync(partialPath)) fs.unlinkSync(partialPath);
    throw error;
  } finally {
    removeDir(staging);
  }
}

/** Архивы этого приложения в каталоге (по шаблону имени), новые первыми. */
export function listBackups(backupDir) {
  if (!fs.existsSync(backupDir)) return [];
  return fs
    .readdirSync(backupDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => ({ name: entry.name, date: parseBackupDate(entry.name) }))
    .filter((entry) => entry.date)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

/**
 * Удаляет архивы этого приложения старше retentionDays (возраст — по метке в имени).
 * Посторонние файлы не трогаются; `keep` никогда не удаляется.
 */
export function applyRetention({ backupDir, retentionDays, now = new Date(), keep }) {
  if (!Number.isFinite(retentionDays) || retentionDays < 1) throw new Error("BACKUP_RETENTION_DAYS должен быть целым числом ≥ 1.");
  const threshold = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  const deleted = [];
  for (const backup of listBackups(backupDir)) {
    if (backup.name === keep || backup.date.getTime() >= threshold) continue;
    fs.unlinkSync(path.join(backupDir, backup.name));
    deleted.push(backup.name);
  }
  return deleted;
}
