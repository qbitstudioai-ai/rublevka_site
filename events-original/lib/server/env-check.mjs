// Проверка конфигурации при запуске сервера (instrumentation.ts) и в тестах.
// Сообщения называют переменные, но никогда не содержат их значений-секретов.
import path from "node:path";

export const REQUIRED_IN_PRODUCTION = ["DATABASE_PATH", "UPLOADS_DIR", "ADMIN_USERNAME", "ADMIN_PASSWORD", "ADMIN_SESSION_SECRET", "APP_URL"];

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const isInside = (child, parent) => {
  const relative = path.relative(parent, child);
  return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative));
};

/**
 * Возвращает ошибки (запуск в production невозможен) и предупреждения.
 * `cwd` — рабочий каталог сервера: в standalone-сборке это .next/standalone.
 */
export function validateEnvironment(env = process.env, { cwd = process.cwd(), production = env.NODE_ENV === "production" } = {}) {
  const errors = [];
  const warnings = [];
  const value = (name) => (env[name] ?? "").trim();

  if (production) {
    const missing = REQUIRED_IN_PRODUCTION.filter((name) => !value(name));
    if (missing.length) errors.push(`Не заданы обязательные переменные: ${missing.join(", ")}.`);

    if (value("ADMIN_PASSWORD") && (env.ADMIN_PASSWORD ?? "").length < 12) errors.push("ADMIN_PASSWORD должен быть не короче 12 символов.");
    if (value("ADMIN_SESSION_SECRET") && (env.ADMIN_SESSION_SECRET ?? "").length < 32) {
      errors.push("ADMIN_SESSION_SECRET должен быть не короче 32 символов.");
    }

    if (value("APP_URL")) {
      try {
        const url = new URL(value("APP_URL"));
        if (url.protocol !== "https:" && !LOCAL_HOSTS.has(url.hostname)) errors.push("APP_URL должен начинаться с https:// (сайт работает за HTTPS).");
        if (url.protocol !== "https:" && url.protocol !== "http:") errors.push("APP_URL должен быть адресом http(s).");
      } catch {
        errors.push("APP_URL должен быть полным адресом, например https://reg.example.ru");
      }
    }

    // Данные не должны попасть в каталоги, которые пересоздаются при сборке или обновлении.
    const ephemeral = [path.join(cwd, ".next"), path.join(cwd, "node_modules")];
    const cwdIsBuildOutput = cwd.split(path.sep).includes(".next");
    for (const name of ["DATABASE_PATH", "UPLOADS_DIR", "BACKUP_DIR"]) {
      if (!value(name)) continue;
      const resolved = path.resolve(cwd, value(name));
      if (ephemeral.some((dir) => isInside(resolved, dir)) || (cwdIsBuildOutput && isInside(resolved, cwd))) {
        errors.push(`${name} указывает внутрь каталога сборки — данные будут потеряны при обновлении. Укажите постоянный каталог (например, /data/...).`);
      }
    }
    if (value("DATABASE_PATH") && value("UPLOADS_DIR") && path.resolve(cwd, value("DATABASE_PATH")) === path.resolve(cwd, value("UPLOADS_DIR"))) {
      errors.push("DATABASE_PATH и UPLOADS_DIR не должны совпадать.");
    }
  }

  // Telegram необязателен, но настраивается только парой значений.
  const hasToken = !!value("TELEGRAM_BOT_TOKEN");
  const hasChat = !!value("TELEGRAM_CHAT_ID");
  if (hasToken !== hasChat) {
    errors.push(`Telegram настроен не полностью: задан ${hasToken ? "TELEGRAM_BOT_TOKEN" : "TELEGRAM_CHAT_ID"}, но не задан ${hasToken ? "TELEGRAM_CHAT_ID" : "TELEGRAM_BOT_TOKEN"}.`);
  }

  if (value("TRUST_PROXY") && !["true", "false"].includes(value("TRUST_PROXY"))) errors.push("TRUST_PROXY может быть только true или false.");
  if (production && value("TRUST_PROXY") !== "true") {
    warnings.push("TRUST_PROXY не включён: ограничение частоты входа и регистраций работает без учёта IP клиента.");
  }
  if (value("BACKUP_RETENTION_DAYS") && !/^[1-9]\d*$/.test(value("BACKUP_RETENTION_DAYS"))) {
    errors.push("BACKUP_RETENTION_DAYS должен быть целым числом ≥ 1.");
  }

  return { errors, warnings };
}
