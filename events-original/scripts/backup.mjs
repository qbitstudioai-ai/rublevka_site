// Резервная копия: npm run backup
// Архив SQLite + uploads в BACKUP_DIR, затем удаление собственных архивов старше BACKUP_RETENTION_DAYS (по умолчанию 30).
import "./load-env.mjs";
import path from "node:path";
import { applyRetention, createBackup } from "../db/backup.mjs";
import { resolveDatabasePath } from "../db/migrator.mjs";

const backupDirValue = process.env.BACKUP_DIR?.trim();
if (!backupDirValue) {
  console.error("Не задан BACKUP_DIR — каталог для резервных копий.");
  process.exit(1);
}
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS?.trim() || 30);
if (!Number.isInteger(retentionDays) || retentionDays < 1) {
  console.error("BACKUP_RETENTION_DAYS должен быть целым числом ≥ 1.");
  process.exit(1);
}

const backupDir = path.resolve(backupDirValue);
const uploadsDir = path.resolve(process.env.UPLOADS_DIR?.trim() || path.join("data", "uploads"));

try {
  const result = await createBackup({ databasePath: resolveDatabasePath(), uploadsDir, backupDir });
  const megabytes = (result.bytes / 1024 / 1024).toFixed(2);
  console.log(`Резервная копия: ${result.fileName} (${megabytes} МБ)`);
  console.log(
    `Мероприятий: ${result.manifest.database.events}, регистраций: ${result.manifest.database.registrations}, файлов: ${result.manifest.uploads.files}.`,
  );
  // Старые копии удаляются только после успешного создания новой.
  const deleted = applyRetention({ backupDir, retentionDays, keep: result.fileName });
  console.log(deleted.length ? `Удалены копии старше ${retentionDays} дн.: ${deleted.join(", ")}` : "Старых копий для удаления нет.");
} catch (error) {
  console.error(`Резервная копия не создана: ${error instanceof Error ? error.message : "неизвестная ошибка"}`);
  process.exit(1);
}
