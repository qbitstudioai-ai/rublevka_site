import "./load-env.mjs";
import { openDatabase, resolveDatabasePath, runMigrations } from "../db/migrator.mjs";

const filePath = resolveDatabasePath();
const db = openDatabase(filePath);
try {
  const { applied, skipped } = runMigrations(db);
  console.log(`База: ${filePath}`);
  console.log(applied.length ? `Применены миграции: ${applied.join(", ")}` : "Новых миграций нет.");
  if (skipped.length) console.log(`Уже применены: ${skipped.join(", ")}`);
} finally {
  db.close();
}
