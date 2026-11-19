import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Подписанная сессия единственного администратора (без зависимостей от Next).
 * Токен: base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload, secret)).
 */

export const SESSION_TTL_SECONDS = 12 * 60 * 60;
const MIN_SECRET_LENGTH = 32;
const MIN_PASSWORD_LENGTH = 12;

export type AdminConfig = { username: string; password: string; secret: string };

/** Читает настройки администратора из env. Без явно заданного секрета админпанель не работает. */
export function readAdminConfig(env: Record<string, string | undefined> = process.env): { config: AdminConfig | null; problem: string | null } {
  const username = env.ADMIN_USERNAME?.trim() ?? "";
  const password = env.ADMIN_PASSWORD ?? "";
  const secret = env.ADMIN_SESSION_SECRET ?? "";
  if (!username || !password || !secret) {
    return { config: null, problem: "Не заданы ADMIN_USERNAME, ADMIN_PASSWORD и ADMIN_SESSION_SECRET." };
  }
  if (secret.length < MIN_SECRET_LENGTH) return { config: null, problem: `ADMIN_SESSION_SECRET должен быть не короче ${MIN_SECRET_LENGTH} символов.` };
  if (password.length < MIN_PASSWORD_LENGTH) return { config: null, problem: `ADMIN_PASSWORD должен быть не короче ${MIN_PASSWORD_LENGTH} символов.` };
  return { config: { username, password, secret }, problem: null };
}

const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

/** Сравнение строк за постоянное время (через хеши одинаковой длины). */
function safeEqual(a: string, b: string) {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

export function checkCredentials(config: AdminConfig, username: string, password: string) {
  // Обе проверки выполняются всегда, чтобы время ответа не выдавало верный логин.
  const userOk = safeEqual(username.trim(), config.username);
  const passwordOk = safeEqual(password, config.password);
  return userOk && passwordOk;
}

export function createSessionToken(secret: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  const payload = Buffer.from(JSON.stringify({ sub: "admin", iat: nowSeconds, exp: nowSeconds + SESSION_TTL_SECONDS })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(token: string | undefined, secret: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!token) return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return false;
  const expected = sign(payload, secret);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.sub === "admin" && typeof data.exp === "number" && data.exp > nowSeconds;
  } catch {
    return false;
  }
}
