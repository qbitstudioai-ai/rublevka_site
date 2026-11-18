import path from "node:path";

/** Окружение e2e-сервера: отдельная БД и uploads, тестовый администратор. */
export const E2E_DATA_DIR = path.join(process.cwd(), ".e2e-data");
export const E2E_DATABASE_PATH = path.join(E2E_DATA_DIR, "e2e.sqlite");
export const E2E_UPLOADS_DIR = path.join(E2E_DATA_DIR, "uploads");
export const E2E_ADMIN = {
  username: "rublevka-admin",
  password: "e2e-very-long-password",
  secret: "e2e-session-secret-0123456789abcdefghijklmnop",
};

/** Фиктивный бот: запросы уходят на локальный mock (tests/telegram-mock.mjs), а не в Telegram. */
export const E2E_TELEGRAM = {
  token: "123456789:E2E-fake-token-abcdefghijklmnopqrstuv",
  chatId: "-1009876543210",
  port: 3199,
  logFile: path.join(E2E_DATA_DIR, "telegram-requests.jsonl"),
};
