/**
 * Простое ограничение частоты в памяти процесса (одна инстанция приложения).
 * Защищает вход в админпанель от перебора и форму регистрации от простого спама.
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function hitRateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [bucketKey, value] of buckets) if (value.resetAt <= now) buckets.delete(bucketKey);
    }
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}

/**
 * IP клиента для ограничения частоты.
 * Заголовкам прокси доверяем только при TRUST_PROXY=true: иначе клиент, подключившийся напрямую,
 * мог бы подставить любой X-Forwarded-For и обойти лимит. Берём X-Real-IP, который прокси
 * перезаписывает, или последний адрес в X-Forwarded-For (его добавил наш прокси, а не клиент).
 * Без доверенного прокси все запросы делят общий ключ.
 */
export function clientKey(headers: Headers, env: Record<string, string | undefined> = process.env) {
  if (env.TRUST_PROXY?.trim() !== "true") return "direct";
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = headers.get("x-forwarded-for")?.split(",").map((part) => part.trim()).filter(Boolean);
  return forwarded?.at(-1) || "direct";
}
