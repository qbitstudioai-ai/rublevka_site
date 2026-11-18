import { expect, test } from "@playwright/test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { MIGRATIONS_DIR, openDatabase, runMigrations } from "@/db/migrator.mjs";
import { validateEnvironment } from "@/lib/server/env-check.mjs";
import { checkHealth } from "@/lib/server/health.mjs";
import { clientKey } from "@/lib/server/rate-limit";
import { tempDir } from "./helpers";

test.describe("/api/health: проверки", () => {
  function healthyApp() {
    const root = tempDir("health-");
    const databasePath = path.join(root, "db.sqlite");
    const db = openDatabase(databasePath);
    runMigrations(db);
    db.close();
    return { root, databasePath, uploadsDir: path.join(root, "uploads") };
  }

  test("здоровое приложение", () => {
    const { databasePath, uploadsDir } = healthyApp();
    expect(checkHealth({ databasePath, uploadsDir })).toEqual({ status: "ok", checks: { database: "ok", migrations: "ok", uploads: "ok" } });
  });

  test("недоступная БД и непримененные миграции", () => {
    const { root, uploadsDir } = healthyApp();
    const missing = checkHealth({ databasePath: path.join(root, "missing.sqlite"), uploadsDir });
    expect(missing).toMatchObject({ status: "degraded", checks: { database: "error", migrations: "error" } });
    // Health не создаёт пустую базу.
    expect(fs.existsSync(path.join(root, "missing.sqlite"))).toBe(false);

    const only001 = path.join(root, "only001");
    fs.mkdirSync(only001);
    fs.copyFileSync(path.join(MIGRATIONS_DIR, "001_initial.sql"), path.join(only001, "001_initial.sql"));
    const oldDbPath = path.join(root, "old.sqlite");
    const oldDb = openDatabase(oldDbPath);
    runMigrations(oldDb, only001);
    oldDb.close();
    expect(checkHealth({ databasePath: oldDbPath, uploadsDir })).toMatchObject({ status: "degraded", checks: { database: "ok", migrations: "pending" } });
  });

  test("проблема с каталогом uploads; ответ без путей и деталей", () => {
    const { root, databasePath } = healthyApp();
    const notADirectory = path.join(root, "uploads-file");
    fs.writeFileSync(notADirectory, "x");
    const result = checkHealth({ databasePath, uploadsDir: notADirectory });
    expect(result).toEqual({ status: "degraded", checks: { database: "ok", migrations: "ok", uploads: "error" } });
    const json = JSON.stringify(result);
    expect(json).not.toContain(root);
    expect(json).not.toMatch(/[\\/]|sqlite|Error/);
  });
});

test.describe("проверка production-окружения", () => {
  const cwd = path.resolve("/srv/app");
  const valid = {
    NODE_ENV: "production",
    DATABASE_PATH: "/data/db/rublevka.sqlite",
    UPLOADS_DIR: "/data/uploads",
    BACKUP_DIR: "/data/backups",
    ADMIN_USERNAME: "owner",
    ADMIN_PASSWORD: "very-long-password",
    ADMIN_SESSION_SECRET: "s".repeat(40),
    APP_URL: "https://reg.example.ru",
    TRUST_PROXY: "true",
  };

  test("корректное окружение", () => {
    expect(validateEnvironment(valid, { cwd })).toEqual({ errors: [], warnings: [] });
    expect(validateEnvironment({ ...valid, TELEGRAM_BOT_TOKEN: "1:abc", TELEGRAM_CHAT_ID: "-100" }, { cwd }).errors).toEqual([]);
  });

  test("отсутствуют обязательные переменные", () => {
    const { errors } = validateEnvironment({ NODE_ENV: "production" }, { cwd });
    expect(errors[0]).toBe(
      "Не заданы обязательные переменные: DATABASE_PATH, UPLOADS_DIR, ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_SESSION_SECRET, APP_URL.",
    );
    // Вне production обязательные переменные не требуются.
    expect(validateEnvironment({}, { cwd, production: false }).errors).toEqual([]);
  });

  test("неполная конфигурация Telegram — в любом режиме", () => {
    const onlyToken = validateEnvironment({ ...valid, TELEGRAM_BOT_TOKEN: "1:secret-token-value" }, { cwd });
    expect(onlyToken.errors).toEqual(["Telegram настроен не полностью: задан TELEGRAM_BOT_TOKEN, но не задан TELEGRAM_CHAT_ID."]);
    expect(JSON.stringify(onlyToken)).not.toContain("secret-token-value");
    expect(validateEnvironment({ TELEGRAM_CHAT_ID: "-100" }, { cwd, production: false }).errors).toHaveLength(1);
  });

  test("слабые секреты, HTTP-адрес, пути внутри каталога сборки", () => {
    const { errors } = validateEnvironment(
      { ...valid, ADMIN_PASSWORD: "short", ADMIN_SESSION_SECRET: "short-secret", APP_URL: "http://reg.example.ru", DATABASE_PATH: ".next/data.sqlite", UPLOADS_DIR: "node_modules/uploads" },
      { cwd },
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        "ADMIN_PASSWORD должен быть не короче 12 символов.",
        "ADMIN_SESSION_SECRET должен быть не короче 32 символов.",
        "APP_URL должен начинаться с https:// (сайт работает за HTTPS).",
        expect.stringContaining("DATABASE_PATH указывает внутрь каталога сборки"),
        expect.stringContaining("UPLOADS_DIR указывает внутрь каталога сборки"),
      ]),
    );
    expect(JSON.stringify(errors)).not.toContain("short-secret");

    // В standalone-сборке рабочий каталог — .next/standalone: относительные пути туда недопустимы.
    const standaloneCwd = path.join(cwd, ".next", "standalone");
    expect(validateEnvironment({ ...valid, DATABASE_PATH: "data/db.sqlite" }, { cwd: standaloneCwd }).errors).toEqual([
      expect.stringContaining("DATABASE_PATH указывает внутрь каталога сборки"),
    ]);
    expect(validateEnvironment(valid, { cwd: standaloneCwd }).errors).toEqual([]);
    // Локальный адрес допустим по HTTP.
    expect(validateEnvironment({ ...valid, APP_URL: "http://127.0.0.1:3000" }, { cwd }).errors).toEqual([]);
  });

  test("без TRUST_PROXY — предупреждение", () => {
    expect(validateEnvironment({ ...valid, TRUST_PROXY: "" }, { cwd }).warnings).toEqual([expect.stringContaining("TRUST_PROXY")]);
    expect(validateEnvironment({ ...valid, TRUST_PROXY: "yes" }, { cwd }).errors).toEqual(["TRUST_PROXY может быть только true или false."]);
  });
});

test("X-Forwarded-For учитывается только за доверенным прокси", () => {
  const spoofed = new Headers({ "x-forwarded-for": "1.2.3.4" });
  expect(clientKey(spoofed, {})).toBe("direct");
  expect(clientKey(spoofed, { TRUST_PROXY: "false" })).toBe("direct");
  // Клиент подставил свой адрес слева, прокси добавил реальный справа.
  expect(clientKey(new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" }), { TRUST_PROXY: "true" })).toBe("203.0.113.7");
  expect(clientKey(new Headers({ "x-real-ip": "198.51.100.1", "x-forwarded-for": "6.6.6.6" }), { TRUST_PROXY: "true" })).toBe("198.51.100.1");
});

test("закрытие SQLite при выходе процесса: WAL сбрасывается, данные сохраняются", () => {
  const databasePath = path.join(tempDir("shutdown-"), "db.sqlite");
  // Так ведёт себя сервер: Next.js по SIGTERM вызывает process.exit, а наш обработчик exit закрывает БД.
  const script = `
    import { openDatabase, runMigrations } from ${JSON.stringify(pathToFileURL(path.resolve("db", "migrator.mjs")).href)};
    const db = openDatabase(process.argv[1]);
    runMigrations(db);
    db.pragma("wal_autocheckpoint = 0");
    db.prepare("INSERT INTO events (slug, title, event_date, start_time) VALUES ('shutdown', 'Тест', '2026-10-24', '16:00')").run();
    process.once("exit", () => db.close());
    process.exit(143);
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script, databasePath], { encoding: "utf8" });
  expect(result.status).toBe(143);
  // Последнее соединение закрыто корректно — файл WAL удалён SQLite.
  expect(fs.existsSync(`${databasePath}-wal`)).toBe(false);
  const db = openDatabase(databasePath);
  expect(db.prepare("SELECT title FROM events WHERE slug = 'shutdown'").get()).toEqual({ title: "Тест" });
  db.close();
});
