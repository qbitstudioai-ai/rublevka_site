import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { openDatabase, resolveDatabasePath, runMigrations } from "../db/migrator.mjs";

const file = resolveDatabasePath();
const marker = file + ".catalog-loaded";
const db = openDatabase(file);
try {
  runMigrations(db);
  if (!existsSync(marker)) {
    const { events } = JSON.parse(
      readFileSync(new URL("../db/public-catalog.json", import.meta.url), "utf8"),
    );
    function insert(table, record) {
      const keys = Object.keys(record);
      const params = keys.map(() => "?").join(", ");
      return db.prepare(`INSERT INTO ${table} (${keys.join(", ")}) VALUES (${params})`)
        .run(...Object.values(record)).lastInsertRowid;
    }
    db.transaction(() => {
      for (const { event, activities } of events) {
        if (db.prepare("SELECT 1 FROM events WHERE slug = ?").get(event.slug)) continue;
        const eventId = insert("events", { ...event, status: "published" });
        for (const { gallery, ...activity } of activities) {
          const activityId = insert("activities", { ...activity, event_id: eventId });
          for (const image of gallery) insert("activity_images", { ...image, activity_id: activityId });
        }
      }
    })();
    writeFileSync(marker, "1\n");
  }
} finally {
  db.close();
}
