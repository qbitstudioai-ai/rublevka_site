"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { todayIso } from "@/lib/format";
import { getDb } from "@/lib/server/db";
import { toReceipt } from "@/lib/server/public-data";
import { clientKey, hitRateLimit } from "@/lib/server/rate-limit";
import { getPublishedEventBySlug } from "@/lib/server/repo/events";
import { createRegistration, RegistrationError } from "@/lib/server/repo/registrations";
import { readTelegramConfig } from "@/lib/server/telegram.mjs";
import { deliverRegistrationNotification } from "@/lib/server/telegram-outbox.mjs";
import { registrationSchema, toFieldErrors, type FieldErrors } from "@/lib/server/validation";
import { SLUG_PATTERN } from "@/lib/slug";
import type { RegistrationReceipt } from "@/lib/types";

export type RegisterResult = { ok: true; receipt: RegistrationReceipt } | { ok: false; fieldErrors?: FieldErrors; message?: string };

/**
 * Реальная регистрация участника. Клиент передаёт только данные участника и id услуг;
 * стоимость, принадлежность услуг мероприятию и snapshots определяет сервер.
 */
export async function registerParticipant(slug: unknown, payload: unknown): Promise<RegisterResult> {
  if (typeof slug !== "string" || !SLUG_PATTERN.test(slug)) return { ok: false, message: "Мероприятие не найдено." };

  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  if (process.env.EVENTS_ORIGINAL_TEST !== "true" || !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host))
    return { ok: false, message: "Приём заявок пока закрыт." };
  // Лимит применяется, когда IP известен (за обратным прокси); общий ключ не должен блокировать всех.
  const key = clientKey(requestHeaders);
  if (key !== "direct" && hitRateLimit(`register:${key}`, 20, 10 * 60 * 1000)) {
    return { ok: false, message: "Слишком много попыток регистрации. Попробуйте через несколько минут." };
  }

  const parsed = registrationSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error), message: "Проверьте данные участника." };

  try {
    const db = getDb();
    const event = getPublishedEventBySlug(db, slug);
    if (!event) return { ok: false, message: "Регистрация на это мероприятие закрыта." };
    // Одна транзакция: регистрация, snapshots и pending-запись outbox (если Telegram настроен).
    const telegram = readTelegramConfig();
    // Дата проверяется внутри транзакции: даже открытая со вчера вкладка не сохранит регистрацию на прошедшее мероприятие.
    const registration = createRegistration(db, event.id, parsed.data, { enqueueTelegram: !!telegram, today: todayIso() });

    // Быстрая попытка после ответа пользователю. Если она не удалась или процесс остановился,
    // запись остаётся в outbox и будет отправлена командой telegram:retry или из админки.
    if (telegram) after(() => deliverRegistrationNotification(db, telegram, registration.id).catch(() => undefined));

    return { ok: true, receipt: toReceipt(registration, event.title) };
  } catch (error) {
    if (error instanceof RegistrationError) return { ok: false, message: error.message };
    console.error("Ошибка сохранения регистрации", error);
    return { ok: false, message: "Не удалось сохранить регистрацию. Попробуйте ещё раз." };
  }
}
