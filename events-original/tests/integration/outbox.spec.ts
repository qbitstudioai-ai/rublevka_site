import { expect, test } from "@playwright/test";
import { execFileSync, spawn } from "node:child_process";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { countRegistrations, createRegistration, RegistrationError } from "@/lib/server/repo/registrations";
import type { TelegramConfig } from "@/lib/server/telegram.mjs";
import {
  deliverOutboxEntry,
  deliverRegistrationNotification,
  loadRegistrationNotice,
  MAX_ATTEMPTS,
  outboxStats,
  processPendingTelegramNotifications,
} from "@/lib/server/telegram-outbox.mjs";
import { registrationSchema } from "@/lib/server/validation";
import { freshDb, makeActivity, makeEvent } from "./helpers";

// Настоящий Telegram не используется: fetch подменяется, для CLI — локальный HTTP-сервер.
const TOKEN = "987654321:OUTBOX-secret-token-ABCDEFGHIJKLMNOPQRS";
const config: TelegramConfig = { token: TOKEN, chatId: "-1001", apiBase: "https://api.telegram.test", appUrl: "https://reg.test" };

type OutboxRow = { id: number; registration_id: number; status: string; attempts: number; last_error: string | null; sent_at: string | null; locked_until: string | null };

function fakeTelegram(behaviour: () => "ok" | "http" | "network" = () => "ok") {
  const texts: string[] = [];
  const fetchImpl = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    texts.push(JSON.parse(String(init?.body)).text);
    const mode = behaviour();
    if (mode === "network") throw new TypeError(`connect ECONNREFUSED https://api.telegram.test/bot${TOKEN}/sendMessage`);
    if (mode === "http") return new Response(JSON.stringify({ ok: false, description: `Bad Gateway for ${TOKEN}` }), { status: 502 });
    return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
  }) as typeof fetch;
  // Одна попытка подключения на одну попытку outbox: повторы внутри отправки проверяет telegram.spec.
  return { texts, fetch: fetchImpl, log: () => undefined, attempts: 1, retryDelayMs: 0 };
}

function setup() {
  const { db } = freshDb();
  const { id: eventId } = makeEvent(db, { title: "Встреча на Рублёвке" });
  const activityId = makeActivity(db, eventId, { title: "Литературная гостиная", price: "3500" });
  const register = (name = "Иванов Иван", enqueueTelegram = true) =>
    createRegistration(db, eventId, registrationSchema.parse({ fullName: name, phone: "+7 900 000-00-00", activityIds: [activityId] }), { enqueueTelegram });
  const outbox = () => db.prepare("SELECT * FROM telegram_notification_outbox ORDER BY id").all() as OutboxRow[];
  return { db, eventId, activityId, register, outbox };
}

test.describe("Telegram outbox", () => {
  test("pending-запись создаётся в транзакции регистрации и только при настроенном Telegram", () => {
    const { db, eventId, register, outbox } = setup();
    const registration = register();
    expect(outbox()).toMatchObject([{ registration_id: registration.id, status: "pending", attempts: 0, last_error: null, sent_at: null }]);

    register("Без Telegram", false);
    expect(outbox()).toHaveLength(1);

    // Неудачная регистрация не оставляет ни регистрации, ни записи outbox.
    expect(() =>
      createRegistration(db, eventId, registrationSchema.parse({ fullName: "Ошибка", phone: "+7 900 000-00-01", activityIds: [999] }), { enqueueTelegram: true }),
    ).toThrow(RegistrationError);
    expect(outbox()).toHaveLength(1);
    expect(countRegistrations(db, eventId)).toBe(2);
  });

  test("успех → sent; повторная обработка не дублирует сообщение", async () => {
    const { db, eventId, register, outbox } = setup();
    const registration = register();
    const telegram = fakeTelegram();

    expect(await deliverRegistrationNotification(db, config, registration.id, telegram)).toBe("sent");
    const [row] = outbox();
    expect(row).toMatchObject({ status: "sent", attempts: 1, last_error: null, locked_until: null });
    expect(row.sent_at).not.toBeNull();
    expect(telegram.texts).toEqual([
      `Новая регистрация на мероприятие «Встреча на Рублёвке»\nhttps://reg.test/meropriyatiya/admin/events/${eventId}/registrations/${registration.public_id}`,
    ]);

    expect(await processPendingTelegramNotifications(db, config, { ...telegram, includeFailed: true })).toMatchObject({ processed: 0, sent: 0 });
    expect(await deliverRegistrationNotification(db, config, registration.id, telegram)).toBe("skipped");
    expect(telegram.texts).toHaveLength(1);
  });

  test("ошибка → pending с причиной без токена; регистрация не откатывается; повтор → sent", async () => {
    const { db, eventId, register, outbox } = setup();
    const registration = register();

    for (const mode of ["network", "http"] as const) {
      const failing = fakeTelegram(() => mode);
      expect(await deliverRegistrationNotification(db, config, registration.id, failing)).toBe("retry");
    }
    const [row] = outbox();
    expect(row).toMatchObject({ status: "pending", attempts: 2, locked_until: null });
    expect(row.last_error).toContain("502");
    expect(row.last_error).not.toContain(TOKEN);
    expect(JSON.stringify(outbox())).not.toContain(TOKEN);
    expect(countRegistrations(db, eventId)).toBe(1);

    const working = fakeTelegram();
    expect(await processPendingTelegramNotifications(db, config, working)).toMatchObject({ processed: 1, sent: 1 });
    expect(outbox()[0]).toMatchObject({ status: "sent", attempts: 3, last_error: null });
  });

  test("после MAX_ATTEMPTS — failed; автоматически не повторяется, вручную — да", async () => {
    const { db, register, outbox } = setup();
    register();
    const failing = fakeTelegram(() => "network");
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      await processPendingTelegramNotifications(db, config, failing);
    }
    expect(outbox()[0]).toMatchObject({ status: "failed", attempts: MAX_ATTEMPTS });
    expect(outboxStats(db)).toEqual({ pending: 0, sent: 0, failed: 1 });

    // Обычный запуск (cron) исчерпавшие попытки не трогает.
    expect(await processPendingTelegramNotifications(db, config, failing)).toMatchObject({ processed: 0 });
    expect(failing.texts).toHaveLength(MAX_ATTEMPTS);

    // Ручной повтор (кнопка/--include-failed): неудача оставляет failed, успех — sent.
    expect(await processPendingTelegramNotifications(db, config, { ...failing, includeFailed: true })).toMatchObject({ processed: 1, failed: 1 });
    expect(outbox()[0].status).toBe("failed");
    expect(await processPendingTelegramNotifications(db, config, { ...fakeTelegram(), includeFailed: true })).toMatchObject({ sent: 1 });
    expect(outboxStats(db)).toEqual({ pending: 0, sent: 1, failed: 0 });
  });

  test("одно уведомление не отправляется параллельно дважды; захват истекает после сбоя процесса", async () => {
    const { db, register, outbox } = setup();
    register();
    const [{ id }] = outbox();

    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const texts: string[] = [];
    const slowFetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      texts.push(String(init?.body));
      await gate;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;
    const first = deliverOutboxEntry(db, config, id, { fetch: slowFetch });
    expect(await deliverOutboxEntry(db, config, id, { fetch: slowFetch })).toBe("skipped");
    release();
    expect(await first).toBe("sent");
    expect(texts).toHaveLength(1);

    // Имитация остановки процесса во время отправки: запись захвачена, но не завершена.
    const second = register("Петров Пётр");
    const now = new Date("2026-10-16T12:00:00.000Z");
    db.prepare("UPDATE telegram_notification_outbox SET locked_until = ?, attempts = 1 WHERE registration_id = ?").run(
      new Date(now.getTime() + 60_000).toISOString(),
      second.id,
    );
    const telegram = fakeTelegram();
    expect(await processPendingTelegramNotifications(db, config, { ...telegram, now })).toMatchObject({ processed: 0 });
    const later = new Date(now.getTime() + 5 * 60_000);
    expect(await processPendingTelegramNotifications(db, config, { ...telegram, now: later })).toMatchObject({ sent: 1 });
  });

  test("в Telegram не уходят персональные данные и выбор участника", async () => {
    const { db, register } = setup();
    const registration = register("Сидорова Анна Петровна");
    // Данные для уведомления даже не читают ФИО, телефон и услуги из базы.
    const notice = JSON.stringify(loadRegistrationNotice(db, registration.id));
    const telegram = fakeTelegram();
    await deliverRegistrationNotification(db, config, registration.id, telegram);
    for (const text of [notice, telegram.texts[0]]) {
      for (const secret of ["Сидорова", "Анна", "+7 900", "000-00-00", "Литературная гостиная", "3500"]) expect(text).not.toContain(secret);
    }
  });

  test("CLI telegram:retry отправляет ожидающие и не печатает токен", async () => {
    const { db, register } = setup();
    register("Первый Участник");
    register("Второй Участник");
    const databasePath = db.name;
    db.close();

    const received: string[] = [];
    const server = http.createServer((request, response) => {
      let body = "";
      request.on("data", (chunk) => (body += chunk));
      request.on("end", () => {
        received.push(JSON.parse(body).text);
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ ok: true }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    try {
      const run = () =>
        new Promise<{ stdout: string; code: number }>((resolve) => {
          const child = spawn(process.execPath, [path.join("scripts", "telegram-retry.mjs")], {
            env: {
              ...process.env,
              DATABASE_PATH: databasePath,
              TELEGRAM_BOT_TOKEN: TOKEN,
              TELEGRAM_CHAT_ID: "-1001",
              TELEGRAM_API_BASE: `http://127.0.0.1:${port}`,
              APP_URL: "https://reg.test/",
            },
          });
          let stdout = "";
          child.stdout.on("data", (chunk) => (stdout += chunk));
          child.stderr.on("data", (chunk) => (stdout += chunk));
          child.on("close", (code) => resolve({ stdout, code: code ?? -1 }));
        });

      const first = await run();
      expect(first.code).toBe(0);
      expect(first.stdout).toContain("Отправлено: 2");
      expect(first.stdout).not.toContain(TOKEN);
      expect(received).toHaveLength(2);
      // Ссылка в админку строится из APP_URL (лишний «/» в конце убирается), имён участников в тексте нет.
      for (const text of received) {
        expect(text).toMatch(/^Новая регистрация на мероприятие «Встреча на Рублёвке»\nhttps:\/\/reg\.test\/meropriyatiya\/admin\/events\/\d+\/registrations\/[0-9a-f-]{36}$/);
        expect(text).not.toContain("Участник");
      }

      const second = await run();
      expect(second.stdout).toContain("Обработано: 0");
      expect(received).toHaveLength(2);
    } finally {
      server.close();
    }

    // Без конфигурации — понятная ошибка и код 1.
    let failed = false;
    try {
      execFileSync(process.execPath, [path.join("scripts", "telegram-retry.mjs")], {
        env: { ...process.env, DATABASE_PATH: databasePath, TELEGRAM_BOT_TOKEN: "", TELEGRAM_CHAT_ID: "" },
        stdio: "pipe",
      });
    } catch (error) {
      failed = true;
      expect(String((error as { stderr: Buffer }).stderr)).toContain("Telegram не настроен");
    }
    expect(failed).toBe(true);
  });
});
