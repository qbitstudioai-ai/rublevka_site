import Database from "better-sqlite3";
import { copyFileSync, mkdirSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { openDatabase, runMigrations } from "../db/migrator.mjs";

const originalDir = resolve(process.argv[2] ?? "../Рублевка_регистрация участников");
const originalFile = realpathSync(join(originalDir, "data", "rublevka.sqlite"));
const localFile = resolve("data/rublevka.sqlite");
if (resolve(originalFile) === localFile) throw new Error("Укажите папку исходного приложения.");
const original = new Database(originalFile, { readonly: true, fileMustExist: true });
const local = openDatabase(localFile);

const upload = /^upload:([0-9a-f-]{36}\.(?:webp|png))$/;
function copyMedia(ref) {
  const filename = upload.exec(ref ?? "")?.[1];
  if (!filename) return;
  const to = join(dirname(localFile), "uploads", filename);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(join(originalDir, "data", "uploads", filename), to);
}
function importRow(table, row) {
  const columns = Object.keys(row);
  const placeholders = columns.map(() => "?").join(", ");
  local.prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`).run(...Object.values(row));
}
try {
  runMigrations(local);
  let added = 0;
  local.transaction(() => {
    for (const event of original.prepare("SELECT * FROM events WHERE status = 'published'").all()) {
      if (local.prepare("SELECT 1 FROM events WHERE slug = ?").get(event.slug)) continue;
      const { id, ...content } = event;
      copyMedia(content.hero_image);
      importRow("events", content);
      const target = local.prepare("SELECT id FROM events WHERE slug = ?").get(event.slug).id;
      for (const activity of original.prepare("SELECT * FROM activities WHERE event_id = ? AND is_active = 1").all(id)) {
        const { id: activityId, ...details } = activity;
        copyMedia(details.card_image);
        importRow("activities", { ...details, event_id: target });
        const newId = local.prepare("SELECT last_insert_rowid() AS id").get().id;
        for (const image of original.prepare("SELECT image_path, alt_text, sort_order FROM activity_images WHERE activity_id = ?").all(activityId)) {
          copyMedia(image.image_path);
          importRow("activity_images", { ...image, activity_id: newId });
        }
      }
      added++;
    }
    const community = original.prepare("SELECT community_title, community_description, community_target_url, community_vk_url, community_max_url, community_qr_image FROM app_settings WHERE id = 1").get();
    if (community) {
      copyMedia(community.community_qr_image);
      local.prepare("UPDATE app_settings SET community_title=@community_title, community_description=@community_description, community_target_url=@community_target_url, community_vk_url=@community_vk_url, community_max_url=@community_max_url, community_qr_image=@community_qr_image WHERE id=1").run(community);
    }
  })();
  console.log("Добавлено опубликованных событий:", added);
} finally {
  original.close();
  local.close();
}
