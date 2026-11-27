import { defineConfig, devices } from "@playwright/test";
import { E2E_ADMIN, E2E_DATABASE_PATH, E2E_TELEGRAM, E2E_UPLOADS_DIR } from "./tests/test-env";

// Отдельный порт, чтобы не пересекаться с локальным сервером разработки на 3000.
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
// 127.0.0.1, а не localhost: standalone-сервер слушает конкретный адрес (HOSTNAME).
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  fullyParallel: false,
  workers: 2,
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    actionTimeout: 15000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      // Локальный mock Telegram Bot API — автотесты не обращаются к настоящему Telegram.
      command: "node tests/telegram-mock.mjs",
      url: `http://127.0.0.1:${E2E_TELEGRAM.port}/`,
      reuseExistingServer: false,
      env: { TELEGRAM_MOCK_PORT: String(E2E_TELEGRAM.port), TELEGRAM_MOCK_TOKEN: E2E_TELEGRAM.token },
    },
    {
      // Каждый запуск — с чистой тестовой БД; рабочая база data/ не затрагивается.
      // Сервер — production-артефакт .next/standalone/server.js, тот же, что в Docker-образе.
      command: "node scripts/e2e-prepare.mjs && node .next/standalone/server.js",
      url: `${baseURL}/meropriyatiya/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NODE_ENV: "production",
        PORT: String(port),
        HOSTNAME: "127.0.0.1",
        APP_URL: baseURL,
        DATABASE_PATH: E2E_DATABASE_PATH,
        UPLOADS_DIR: E2E_UPLOADS_DIR,
        EVENTS_ORIGINAL_TEST: "true",
        ADMIN_USERNAME: E2E_ADMIN.username,
        ADMIN_PASSWORD: E2E_ADMIN.password,
        ADMIN_SESSION_SECRET: E2E_ADMIN.secret,
        TELEGRAM_BOT_TOKEN: E2E_TELEGRAM.token,
        TELEGRAM_CHAT_ID: E2E_TELEGRAM.chatId,
        TELEGRAM_API_BASE: `http://127.0.0.1:${E2E_TELEGRAM.port}`,
      },
    },
  ],
  projects: [
    { name: "integration", testDir: "./tests/integration" },
    { name: "desktop", testDir: "./tests/e2e", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", testDir: "./tests/e2e", use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 390, height: 844 } } },
    // Меняют общие настройки (QR, способ оплаты) — запускаются после остальных e2e, чтобы им не мешать.
    {
      name: "settings",
      testDir: "./tests/e2e-settings",
      dependencies: ["desktop", "mobile"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
    },
  ],
});
