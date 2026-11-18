/**
 * Уведомления администрации через Telegram Bot API (без внешних сервисов).
 * Telegram — зарубежный сервис, поэтому персональные данные участников туда не отправляются:
 * в сообщении только название мероприятия и ссылка на регистрацию в админке (сервер в РФ).
 * Токен берётся только из env и никогда не попадает в БД, ответы клиенту и логи.
 * Модуль на чистом JS: его используют и приложение, и CLI `npm run telegram:retry`.
 * Типы — в telegram.d.mts.
 */

const DEFAULT_API_BASE = "https://api.telegram.org";
const MAX_MESSAGE_LENGTH = 4000;

export function readTelegramConfig(env = process.env) {
  const token = env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  const chatId = env.TELEGRAM_CHAT_ID?.trim() ?? "";
  if (!token || !chatId) return null;
  const apiBase = (env.TELEGRAM_API_BASE?.trim() || DEFAULT_API_BASE).replace(/\/+$/, "");
  // Адрес сайта — для ссылки на регистрацию в админке; без него сообщение уходит без ссылки.
  const appUrl = (env.APP_URL?.trim() ?? "").replace(/\/+$/, "");
  return { token, chatId, apiBase, appUrl };
}

/** Убирает токен из любого текста перед логированием или показом. */
export function redactSecret(text, token) {
  if (!token) return text;
  return text.split(token).join("***").split(encodeURIComponent(token)).join("***");
}

const DEFAULT_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 6_000;
const DEFAULT_RETRY_DELAY_MS = 700;

/**
 * Отправляет текстовое сообщение. Никогда не бросает исключений.
 * Сетевая ошибка и тайм-аут повторяются новым соединением (до `attempts` раз): у некоторых
 * хостингов в РФ подключение к api.telegram.org выборочно обрывается, и следующая попытка
 * обычно проходит. Ответ самого Telegram (http/api) не повторяется — повтор его не исправит.
 * Если запрос ушёл, а ответ не дождались, сообщение может прийти дважды — как и у outbox,
 * доставка «хотя бы один раз».
 */
export async function sendTelegramMessage(config, text, deps = {}) {
  const attempts = Math.max(1, deps.attempts ?? DEFAULT_ATTEMPTS);
  let result;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    result = await sendOnce(config, text, deps);
    if (result.ok || result.reason === "http" || result.reason === "api") return result;
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, deps.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS));
  }
  return result;
}

async function sendOnce(config, text, deps) {
  const fetchImpl = deps.fetch ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${config.apiBase}/bot${config.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: text.length > MAX_MESSAGE_LENGTH ? `${text.slice(0, MAX_MESSAGE_LENGTH)}…` : text,
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (response.ok && payload?.ok) return { ok: true };
    return {
      ok: false,
      reason: response.ok ? "api" : "http",
      status: response.status,
      description: payload?.description ? redactSecret(String(payload.description), config.token).slice(0, 200) : undefined,
    };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return { ok: false, reason: aborted ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Текст уведомления ----------

/**
 * «Новая регистрация на мероприятие «…»» и ссылка на регистрацию в админке.
 * ФИО, телефон, мессенджер и выбранные услуги в Telegram не отправляются — только в админке.
 * Ссылка содержит случайный public_id регистрации, а не персональные данные.
 */
export function formatRegistrationMessage({ event, registration }, appUrl = "") {
  const lines = [`Новая регистрация на мероприятие «${event.title}»`];
  if (appUrl) lines.push(`${appUrl}/admin/events/${event.id}/registrations/${registration.public_id}`);
  return lines.join("\n");
}

export const TEST_MESSAGE = "✅ Тестовое уведомление\n\nСвязь с системой регистрации «Рублёвки» работает.";

export const describeFailure = (result) =>
  [result.reason, result.status, result.description].filter((part) => part !== undefined && part !== "").join(" ");

/**
 * Уведомление о новой регистрации. Вызывается после commit; ошибка Telegram
 * логируется без секретов и не влияет на уже сохранённую регистрацию.
 */
export async function notifyNewRegistration(config, notice, deps = {}) {
  const log = deps.log ?? ((message) => console.error(message));
  try {
    const result = await sendTelegramMessage(config, formatRegistrationMessage(notice, config.appUrl), deps);
    if (!result.ok) {
      log(redactSecret(`Telegram: уведомление о регистрации ${notice.registration.public_id} не отправлено (${describeFailure(result)})`, config.token));
    }
    return result;
  } catch (error) {
    // Защита на случай непредвиденной ошибки форматирования: приложение не должно падать.
    log(redactSecret(`Telegram: ошибка при подготовке уведомления (${error instanceof Error ? error.name : "unknown"})`, config.token));
    return { ok: false, reason: "network" };
  }
}

/** Понятное администратору описание результата без технических деталей и секретов. */
export function describeTestResult(result) {
  if (result.ok) return "Тестовое уведомление отправлено. Проверьте чат в Telegram.";
  if (result.status === 401 || result.status === 404) return "Ошибка: Telegram не принял токен бота. Проверьте TELEGRAM_BOT_TOKEN.";
  if (result.status === 400 || result.status === 403) return "Ошибка: бот не может написать в этот чат. Проверьте TELEGRAM_CHAT_ID и что бот добавлен в чат.";
  return "Ошибка подключения к Telegram. Попробуйте позже.";
}
