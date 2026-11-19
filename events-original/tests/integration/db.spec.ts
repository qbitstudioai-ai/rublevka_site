import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { MIGRATIONS_DIR, openDatabase, pendingMigrations, runMigrations } from "@/db/migrator.mjs";
import { getDb } from "@/lib/server/db";
import { tempDir } from "./helpers";

const run = (script: string, databasePath: string) =>
  execFileSync(process.execPath, [path.join("scripts", script)], {
    env: { ...process.env, DATABASE_PATH: databasePath },
    encoding: "utf8",
  });

test.describe("SQLite: миграции и seed", () => {
  test("миграция чистой БД, повторный migrate и seed", () => {
    const databasePath = path.join(tempDir(), "fresh.sqlite");

    const first = run("db-migrate.mjs", databasePath);
    expect(first).toContain(
      "Применены миграции: 001_initial.sql, 002_optional_messenger_and_snapshot_position.sql, 003_telegram_notification_outbox.sql, 004_payment_methods.sql, 005_community_platforms.sql, 006_event_end_and_hero_fit.sql, 007_event_price.sql, 008_event_extra_info.sql, 009_event_long_description.sql",
    );

    const second = run("db-migrate.mjs", databasePath);
    expect(second).toContain("Новых миграций нет.");

    const db = openDatabase(databasePath);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((row) => (row as { name: string }).name);
    expect(tables).toEqual(
      expect.arrayContaining(["activities", "activity_images", "app_settings", "events", "registration_activities", "registrations", "schema_migrations", "telegram_notification_outbox"]),
    );
    expect(db.prepare("SELECT COUNT(*) AS c FROM schema_migrations").get()).toEqual({ c: 9 });
    expect(db.pragma("journal_mode", { simple: true })).toBe("wal");
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
    db.close();

    expect(run("db-seed.mjs", databasePath)).toContain("создано");
    expect(run("db-seed.mjs", databasePath)).toContain("уже существует");

    const seeded = openDatabase(databasePath);
    const event = seeded.prepare("SELECT * FROM events WHERE slug = 'vstrecha-na-rublevke'").get() as { id: number; status: string };
    expect(event.status).toBe("published");
    expect(seeded.prepare("SELECT COUNT(*) AS c FROM activities WHERE event_id = ?").get(event.id)).toEqual({ c: 4 });
    expect(seeded.prepare("SELECT COUNT(*) AS c FROM activity_images").get()).toEqual({ c: 8 });
    const prices = seeded
      .prepare("SELECT title, pricing_type, fixed_price_kopecks FROM activities ORDER BY sort_order")
      .all() as { title: string; pricing_type: string; fixed_price_kopecks: number | null }[];
    expect(prices.map((row) => [row.pricing_type, row.fixed_price_kopecks])).toEqual([
      ["fixed", 350000],
      ["contact", null],
      ["free", 0],
      ["fixed", 650000],
    ]);
    // Seed ставит демо-QR; текст и ссылки сообществ — из миграции 005.
    const settings = seeded.prepare("SELECT payment_qr_image, community_qr_image, community_title, community_vk_url FROM app_settings").get();
    expect(settings).toEqual({
      payment_qr_image: "/mock/qr-payment-demo.svg",
      community_qr_image: "/mock/qr-community-demo.svg",
      community_title: "Выбирайте удобное для Вас сообщество",
      community_vk_url: "https://vk.ru/rublevka34ru",
    });
    seeded.close();
  });

  test("изменённая после применения миграция обнаруживается", () => {
    const dir = tempDir();
    const migrations = path.join(dir, "migrations");
    fs.mkdirSync(migrations);
    fs.writeFileSync(path.join(migrations, "001_test.sql"), "CREATE TABLE t (id INTEGER);");
    const db = openDatabase(path.join(dir, "db.sqlite"));
    expect(runMigrations(db, migrations).applied).toEqual(["001_test.sql"]);
    fs.writeFileSync(path.join(migrations, "001_test.sql"), "CREATE TABLE t (id INTEGER, name TEXT);");
    expect(() => runMigrations(db, migrations)).toThrow(/изменена после применения/);
    db.close();
  });

  test("приложение не работает с немигрированной БД", () => {
    const databasePath = path.join(tempDir(), "empty.sqlite");
    const db = openDatabase(databasePath);
    expect(pendingMigrations(db)).toEqual([
      "001_initial.sql",
      "002_optional_messenger_and_snapshot_position.sql",
      "003_telegram_notification_outbox.sql",
      "004_payment_methods.sql",
      "005_community_platforms.sql",
      "006_event_end_and_hero_fit.sql",
      "007_event_price.sql",
      "008_event_extra_info.sql",
      "009_event_long_description.sql",
    ]);
    db.close();

    const previous = process.env.DATABASE_PATH;
    process.env.DATABASE_PATH = databasePath;
    try {
      expect(() => getDb()).toThrow(/npm run db:migrate/);
    } finally {
      process.env.DATABASE_PATH = previous;
    }
  });

  test("миграция 005 заполняет сообщества, но не трогает изменённое администратором", () => {
    // Две базы в состоянии после 004: с текстом по умолчанию и с текстом администратора.
    const dir = tempDir();
    const upTo004 = path.join(dir, "migrations");
    fs.mkdirSync(upTo004);
    for (const file of fs.readdirSync(MIGRATIONS_DIR).filter((name) => name < "005")) {
      fs.copyFileSync(path.join(MIGRATIONS_DIR, file), path.join(upTo004, file));
    }
    const defaults = openDatabase(path.join(dir, "defaults.sqlite"));
    const edited = openDatabase(path.join(dir, "edited.sqlite"));
    for (const db of [defaults, edited]) runMigrations(db, upTo004);
    edited
      .prepare("UPDATE app_settings SET community_title = 'Наш клуб', community_description = 'Свой текст', community_target_url = 'https://t.me/own'")
      .run();
    for (const db of [defaults, edited]) expect(runMigrations(db).applied).toEqual(["005_community_platforms.sql", "006_event_end_and_hero_fit.sql", "007_event_price.sql", "008_event_extra_info.sql", "009_event_long_description.sql"]);

    const select = "SELECT community_title, community_description, community_target_url, community_vk_url, community_max_url FROM app_settings";
    expect(defaults.prepare(select).get()).toEqual({
      community_title: "Выбирайте удобное для Вас сообщество",
      community_description: "В сообществах мы делимся новостями «Рублёвки», анонсами встреч и фотографиями с прошедших событий, общаемся лично.",
      community_target_url: "https://t.me/+-G2HEy3Y79M2YmYy",
      community_vk_url: "https://vk.ru/rublevka34ru",
      community_max_url: "https://web.max.ru/join/W4hPFGLIY250awhUiexEKstMeE5aNQLnMPaHnDb8Bfg",
    });
    expect(edited.prepare(select).get()).toMatchObject({
      community_title: "Наш клуб",
      community_description: "Свой текст",
      community_target_url: "https://t.me/own",
    });
    defaults.close();
    edited.close();
  });

  test("миграция 002 переносит существующие регистрации без потерь", () => {
    // База в состоянии после 001: применяем только первую миграцию.
    const dir = tempDir();
    const only001 = path.join(dir, "migrations");
    fs.mkdirSync(only001);
    fs.copyFileSync(path.join(MIGRATIONS_DIR, "001_initial.sql"), path.join(only001, "001_initial.sql"));
    const db = openDatabase(path.join(dir, "db.sqlite"));
    runMigrations(db, only001);

    db.exec(`
      INSERT INTO events (id, slug, title, event_date, start_time, status) VALUES (1, 'ev', 'Событие', '2026-10-24', '16:00', 'published');
      INSERT INTO activities (id, event_id, title, pricing_type, fixed_price_kopecks, sort_order) VALUES
        (1, 1, 'Первая', 'fixed', 350000, 1), (2, 1, 'Вторая', 'free', 0, 2), (3, 1, 'Третья', 'contact', NULL, 3);
      INSERT INTO registrations (id, public_id, event_id, full_name, phone, messenger, fixed_total_kopecks, created_at) VALUES
        (1, 'p1', 1, 'Иванов Иван', '+79000000001', 'Telegram: @ivanov', 350000, '2026-10-16T10:00:00.000Z'),
        (2, 'p2', 1, 'Петров Пётр', '+79000000002', '', 0, '2026-10-16T11:00:00.000Z');
      INSERT INTO registration_activities (id, registration_id, activity_id, activity_title_snapshot, pricing_type_snapshot, fixed_price_kopecks_snapshot) VALUES
        (10, 1, 1, 'Первая', 'fixed', 350000), (11, 1, 2, 'Вторая', 'free', 0), (12, 1, 3, 'Третья', 'contact', NULL), (13, 2, 2, 'Вторая', 'free', 0);
    `);

    expect(runMigrations(db).applied).toEqual([
      "002_optional_messenger_and_snapshot_position.sql",
      "003_telegram_notification_outbox.sql",
      "004_payment_methods.sql",
      "005_community_platforms.sql",
      "006_event_end_and_hero_fit.sql",
      "007_event_price.sql",
      "008_event_extra_info.sql",
      "009_event_long_description.sql",
    ]);

    expect(db.prepare("SELECT id, public_id, messenger, fixed_total_kopecks, created_at FROM registrations ORDER BY id").all()).toEqual([
      { id: 1, public_id: "p1", messenger: "Telegram: @ivanov", fixed_total_kopecks: 350000, created_at: "2026-10-16T10:00:00.000Z" },
      { id: 2, public_id: "p2", messenger: null, fixed_total_kopecks: 0, created_at: "2026-10-16T11:00:00.000Z" },
    ]);
    expect(db.prepare("SELECT id, registration_id, position FROM registration_activities ORDER BY id").all()).toEqual([
      { id: 10, registration_id: 1, position: 1 },
      { id: 11, registration_id: 1, position: 2 },
      { id: 12, registration_id: 1, position: 3 },
      { id: 13, registration_id: 2, position: 1 },
    ]);
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(db.pragma("foreign_key_check")).toEqual([]);

    // Каскад registrations → snapshots продолжает работать.
    db.prepare("DELETE FROM registrations WHERE id = 1").run();
    expect(db.prepare("SELECT COUNT(*) AS c FROM registration_activities").get()).toEqual({ c: 1 });
    // Пустая строка вместо NULL не допускается.
    expect(() =>
      db.prepare("INSERT INTO registrations (public_id, event_id, full_name, phone, messenger, fixed_total_kopecks) VALUES ('p3', 1, 'X', '+7', '  ', 0)").run(),
    ).toThrow(/CHECK/);
    db.close();
  });
});
