import { expect, test } from "@playwright/test";
import { getEventById } from "@/lib/server/repo/events";
import { countRegistrations, createRegistration, getRegistrationByPublicId } from "@/lib/server/repo/registrations";
import {
  describeTestResult,
  formatRegistrationMessage,
  notifyNewRegistration,
  readTelegramConfig,
  sendTelegramMessage,
  TEST_MESSAGE,
  type TelegramConfig,
} from "@/lib/server/telegram.mjs";
import { registrationSchema } from "@/lib/server/validation";
import { freshDb, makeActivity, makeEvent } from "./helpers";

// Автотесты никогда не обращаются к настоящему Telegram: fetch подменяется.
const TOKEN = "123456789:SECRET-token-ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const config: TelegramConfig = { token: TOKEN, chatId: "-1001234567890", apiBase: "https://api.telegram.test", appUrl: "https://reg.test" };

type Call = { url: string; body: { chat_id: string; text: string } };

function mockFetch(respond: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), body: JSON.parse(String(init?.body)) };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  return { calls, fetchImpl };
}

const okResponse = () => new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });

function setup() {
  const { db } = freshDb();
  const { id: eventId } = makeEvent(db, { title: "Встреча на Рублёвке", eventDate: "2026-10-24", startTime: "16:00" });
  const fixed = makeActivity(db, eventId, { title: "Литературная гостиная", price: "3500" });
  const contact = makeActivity(db, eventId, { title: "Проживание", pricingType: "contact" });
  const free = makeActivity(db, eventId, { title: "Песни у костра", pricingType: "free" });
  const register = (activityIds: number[], messenger?: string) =>
    createRegistration(db, eventId, registrationSchema.parse({ fullName: "Иванов Иван Иванович", phone: "+7 900 000-00-00", messenger, activityIds }));
  return { db, event: getEventById(db, eventId)!, eventId, fixed, contact, free, register };
}

test.describe("Telegram: текст уведомления", () => {
  test("только мероприятие и ссылка на регистрацию в админке — без персональных данных", () => {
    const { event, eventId, fixed, contact, free, register } = setup();
    const registration = register([fixed, contact, free], "Telegram: @ivanov");
    const message = formatRegistrationMessage({ event, registration }, "https://reg.test");
    expect(message).toBe(
      `Новая регистрация на мероприятие «Встреча на Рублёвке»\nhttps://reg.test/meropriyatiya/admin/events/${eventId}/registrations/${registration.public_id}`,
    );
    for (const secret of ["Иванов", "+7 900", "@ivanov", "Литературная гостиная", "Проживание", "3 500", "сумма"]) expect(message).not.toContain(secret);
  });

  test("без адреса сайта — только строка о регистрации", () => {
    const { event, register } = setup();
    expect(formatRegistrationMessage({ event, registration: register([]) })).toBe("Новая регистрация на мероприятие «Встреча на Рублёвке»");
  });

  test("уведомление о платном мероприятии тоже без сумм", () => {
    const { db } = freshDb();
    const { id: eventId } = makeEvent(db, { title: "Велесова ночь", eventDate: "2026-10-31", startTime: "17:00", price: "1500" });
    const registration = createRegistration(db, eventId, registrationSchema.parse({ fullName: "Петров Пётр", phone: "+7 900 000-00-00", activityIds: [] }));
    const message = formatRegistrationMessage({ event: getEventById(db, eventId)!, registration }, "https://reg.test");
    expect(message.split("\n")[0]).toBe("Новая регистрация на мероприятие «Велесова ночь»");
    expect(message).not.toContain("₽");
    expect(message).not.toContain("Петров");
  });
});

test.describe("Telegram: отправка", () => {
  test("успешная отправка: правильный адрес, чат и текст", async () => {
    const { calls, fetchImpl } = mockFetch(okResponse);
    expect(await sendTelegramMessage(config, TEST_MESSAGE, { fetch: fetchImpl })).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`https://api.telegram.test/bot${TOKEN}/sendMessage`);
    expect(calls[0].body).toMatchObject({ chat_id: "-1001234567890", text: TEST_MESSAGE });
  });

  test("сетевая ошибка и тайм-аут повторяются новым соединением, ответ Telegram — нет", async () => {
    // Две неудачи подключения, затем успех — как при выборочной блокировке у хостинга.
    let calls = 0;
    const flaky = (async () => {
      calls += 1;
      if (calls <= 2) throw new TypeError("fetch failed");
      return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
    }) as typeof fetch;
    expect(await sendTelegramMessage(config, "x", { fetch: flaky, retryDelayMs: 0 })).toEqual({ ok: true });
    expect(calls).toBe(3);

    // Все попытки неудачны — столько вызовов, сколько попыток.
    calls = 0;
    const down = (async () => {
      calls += 1;
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    expect(await sendTelegramMessage(config, "x", { fetch: down, retryDelayMs: 0, attempts: 4 })).toEqual({ ok: false, reason: "network" });
    expect(calls).toBe(4);

    // Ответ Telegram (неверный токен) повтором не исправить — одна попытка.
    const unauthorized = mockFetch(() => new Response(JSON.stringify({ ok: false, description: "Unauthorized" }), { status: 401 }));
    expect(await sendTelegramMessage(config, "x", { fetch: unauthorized.fetchImpl, retryDelayMs: 0 })).toMatchObject({ reason: "http", status: 401 });
    expect(unauthorized.calls).toHaveLength(1);
  });

  test("ошибки не раскрывают токен", async () => {
    // Ответ API с токеном в описании.
    const rejected = mockFetch(() => new Response(JSON.stringify({ ok: false, description: `Unauthorized for ${TOKEN}` }), { status: 401 }));
    const httpResult = await sendTelegramMessage(config, "x", { fetch: rejected.fetchImpl });
    expect(httpResult).toMatchObject({ ok: false, reason: "http", status: 401 });
    expect(JSON.stringify(httpResult)).not.toContain(TOKEN);
    expect(describeTestResult(httpResult)).toContain("TELEGRAM_BOT_TOKEN");
    expect(describeTestResult(httpResult)).not.toContain(TOKEN);

    // Сетевая ошибка с адресом (и токеном) в сообщении.
    const broken = mockFetch(() => {
      throw new TypeError(`fetch failed: https://api.telegram.test/bot${TOKEN}/sendMessage`);
    });
    const networkResult = await sendTelegramMessage(config, "x", { fetch: broken.fetchImpl });
    expect(networkResult).toEqual({ ok: false, reason: "network" });
    expect(describeTestResult(networkResult)).toBe("Ошибка подключения к Telegram. Попробуйте позже.");

    // Таймаут.
    const hanging = (async (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))))) as typeof fetch;
    expect(await sendTelegramMessage(config, "x", { fetch: hanging, timeoutMs: 20 })).toEqual({ ok: false, reason: "timeout" });
  });

  test("сбой Telegram не откатывает регистрацию и не роняет приложение", async () => {
    const { db, event, eventId, fixed, register } = setup();
    const registration = register([fixed]);
    const logs: string[] = [];
    const failing = mockFetch(() => {
      throw new TypeError(`connect ECONNREFUSED for bot${TOKEN}`);
    });

    const result = await notifyNewRegistration(config, { event, registration }, { fetch: failing.fetchImpl, log: (line) => logs.push(line) });

    expect(result.ok).toBe(false);
    expect(countRegistrations(db, eventId)).toBe(1);
    expect(getRegistrationByPublicId(db, registration.public_id)?.fixed_total_kopecks).toBe(350000);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain(registration.public_id);
    expect(logs.join("\n")).not.toContain(TOKEN);

    // HTTP-ошибка с токеном в описании тоже логируется без секрета.
    const rejected = mockFetch(() => new Response(JSON.stringify({ ok: false, description: `bad token ${TOKEN}` }), { status: 401 }));
    await notifyNewRegistration(config, { event, registration }, { fetch: rejected.fetchImpl, log: (line) => logs.push(line) });
    expect(logs[1]).toContain("401");
    expect(logs.join("\n")).not.toContain(TOKEN);
  });

  test("настройка только через env", () => {
    expect(readTelegramConfig({})).toBeNull();
    expect(readTelegramConfig({ TELEGRAM_BOT_TOKEN: TOKEN })).toBeNull();
    expect(readTelegramConfig({ TELEGRAM_CHAT_ID: "-100" })).toBeNull();
    expect(readTelegramConfig({ TELEGRAM_BOT_TOKEN: ` ${TOKEN} `, TELEGRAM_CHAT_ID: "-100" })).toEqual({
      token: TOKEN,
      chatId: "-100",
      apiBase: "https://api.telegram.org",
      appUrl: "",
    });
    expect(readTelegramConfig({ TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: "-100", APP_URL: " https://reg.test/ " })?.appUrl).toBe("https://reg.test");
  });
});
