"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { endAdminSession, requireAdmin, startAdminSession } from "@/lib/server/admin-auth";
import { getDb } from "@/lib/server/db";
import { clientKey, hitRateLimit, resetRateLimit } from "@/lib/server/rate-limit";
import {
  createActivity,
  deleteActivity,
  getActivity,
  moveActivity,
  setActivityActive,
  updateActivity,
} from "@/lib/server/repo/activities";
import { createEvent, deleteEvent, getEventById, setEventStatus, SlugTakenError, updateEvent } from "@/lib/server/repo/events";
import { countRegistrations, deleteRegistrationsForEvent } from "@/lib/server/repo/registrations";
import { getSettings, updateSettings } from "@/lib/server/repo/settings";
import { checkCredentials, readAdminConfig } from "@/lib/server/session";
import { describeTestResult, readTelegramConfig, sendTelegramMessage, TEST_MESSAGE } from "@/lib/server/telegram.mjs";
import { processPendingTelegramNotifications } from "@/lib/server/telegram-outbox.mjs";
import { deleteOrphanUploads, pickFile, removeUploads, saveImage, UploadError, type UploadKind } from "@/lib/server/uploads";
import {
  activitySchema,
  eventSchema,
  eventStatusSchema,
  idSchema,
  settingsSchema,
  toFieldErrors,
  usesQr,
  type FieldErrors,
} from "@/lib/server/validation";

/**
 * Server actions админпанели. Каждое действие само проверяет сессию администратора:
 * проверка в layout не защищает прямые POST-запросы.
 */

export type ActionState = { ok?: boolean; message?: string; errors?: FieldErrors };

const MAX_GALLERY_FILES_PER_SAVE = 6;

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

/** Перестраивает все страницы: данные меняются редко, а страницы и так динамические. */
const refreshAll = () => revalidatePath("/", "layout");

/** Сохраняет файлы; при ошибке удаляет уже сохранённые и пробрасывает UploadError. */
async function saveFiles(files: { file: File | null; kind: UploadKind }[]) {
  const saved: (string | null)[] = [];
  try {
    for (const { file, kind } of files) saved.push(file ? await saveImage(file, kind) : null);
    return saved;
  } catch (error) {
    await removeUploads(saved);
    throw error;
  }
}

// ---------- Вход и выход ----------

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { config, problem } = readAdminConfig();
  if (!config) return { message: `Админпанель не настроена: ${problem}` };

  const key = `login:${clientKey(await headers())}`;
  if (hitRateLimit(key, 8, 15 * 60 * 1000)) return { message: "Слишком много попыток входа. Подождите 15 минут." };

  if (!checkCredentials(config, text(formData, "username"), text(formData, "password"))) {
    return { message: "Неверный логин или пароль." };
  }
  resetRateLimit(key);
  await startAdminSession();
  redirect("/admin");
}

export async function logoutAction() {
  await endAdminSession();
  redirect("/admin/login");
}

// ---------- Мероприятия ----------

const parseEventForm = (formData: FormData) =>
  eventSchema.safeParse({
    title: text(formData, "title"),
    slug: text(formData, "slug"),
    eventDate: text(formData, "eventDate"),
    startTime: text(formData, "startTime"),
    endDate: text(formData, "endDate"),
    endTime: text(formData, "endTime"),
    shortDescription: text(formData, "shortDescription"),
    extraInfo: text(formData, "extraInfo"),
    longDescription: text(formData, "longDescription"),
    locationText: text(formData, "locationText"),
    heroFit: text(formData, "heroFit") || "cover",
    price: text(formData, "price"),
    status: text(formData, "status"),
  });

export async function createEventAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseEventForm(formData);
  if (!parsed.success) return { errors: toFieldErrors(parsed.error), message: "Проверьте поля формы." };

  let hero: string | null;
  try {
    [hero] = await saveFiles([{ file: pickFile(formData.get("heroImage")), kind: "photo" }]);
  } catch (error) {
    if (error instanceof UploadError) return { errors: { heroImage: error.message } };
    throw error;
  }

  let id: number;
  try {
    id = createEvent(getDb(), parsed.data, hero);
  } catch (error) {
    await removeUploads([hero]);
    if (error instanceof SlugTakenError) return { errors: { slug: error.message } };
    throw error;
  }
  refreshAll();
  redirect(`/admin/events/${id}?created=1`);
}

export async function updateEventAction(eventId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = idSchema.parse(eventId);
  const parsed = parseEventForm(formData);
  if (!parsed.success) return { errors: toFieldErrors(parsed.error), message: "Проверьте поля формы." };

  let newHero: string | null;
  try {
    [newHero] = await saveFiles([{ file: pickFile(formData.get("heroImage")), kind: "photo" }]);
  } catch (error) {
    if (error instanceof UploadError) return { errors: { heroImage: error.message } };
    throw error;
  }
  const heroChange = newHero ?? (formData.get("removeHero") === "on" ? null : undefined);

  const db = getDb();
  let result: ReturnType<typeof updateEvent>;
  try {
    result = updateEvent(db, id, parsed.data, heroChange);
  } catch (error) {
    await removeUploads([newHero]);
    if (error instanceof SlugTakenError) return { errors: { slug: error.message } };
    throw error;
  }
  if (!result) {
    await removeUploads([newHero]);
    return { message: "Мероприятие не найдено." };
  }
  // Старый файл удаляется только после успешного commit и только если больше не используется.
  await deleteOrphanUploads(db, [result.replacedHero]);
  refreshAll();
  // Redirect, а не сообщение в state: форма пересоздаётся со свежими данными (в т.ч. статусом).
  redirect(`/admin/events/${id}?saved=1`);
}

export async function setEventStatusAction(formData: FormData) {
  await requireAdmin();
  const id = idSchema.parse(text(formData, "eventId"));
  const status = eventStatusSchema.parse(text(formData, "status"));
  setEventStatus(getDb(), id, status);
  refreshAll();
}

export async function deleteRegistrationsAction(eventId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = idSchema.parse(eventId);
  if (formData.get("confirm") !== "on") return { message: "Отметьте подтверждение удаления." };

  const db = getDb();
  const current = countRegistrations(db, id);
  const expected = Number(text(formData, "expectedCount"));
  if (current !== expected) {
    return { message: `Пока вы подтверждали, количество регистраций изменилось: сейчас ${current}. Обновите страницу и подтвердите снова.` };
  }
  const deleted = deleteRegistrationsForEvent(db, id);
  refreshAll();
  redirect(`/admin/events/${id}?registrationsDeleted=${deleted}#cleanup`);
}

export async function deleteEventAction(eventId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = idSchema.parse(eventId);
  const db = getDb();
  const event = getEventById(db, id);
  if (!event) return { message: "Мероприятие уже удалено." };
  if (text(formData, "confirmTitle").trim() !== event.title.trim()) {
    return { errors: { confirmTitle: "Название введено неточно. Удаление не выполнено." } };
  }
  const { imageRefs } = deleteEvent(db, id);
  await deleteOrphanUploads(db, imageRefs);
  refreshAll();
  redirect(`/admin?deleted=${encodeURIComponent(event.title)}`);
}

// ---------- Услуги ----------

const parseActivityForm = (formData: FormData) =>
  activitySchema.safeParse({
    title: text(formData, "title"),
    shortDescription: text(formData, "shortDescription"),
    longDescription: text(formData, "longDescription"),
    startTime: text(formData, "startTime"),
    durationText: text(formData, "durationText"),
    pricingType: text(formData, "pricingType"),
    price: text(formData, "price"),
    priceSuffix: text(formData, "priceSuffix"),
    details: text(formData, "details"),
    isActive: formData.get("isActive") === "on",
  });

export async function saveActivityAction(
  eventId: number,
  activityId: number | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const id = idSchema.parse(eventId);
  const db = getDb();
  if (!getEventById(db, id)) return { message: "Мероприятие не найдено." };
  if (activityId !== null && !getActivity(db, id, idSchema.parse(activityId))) return { message: "Услуга не найдена." };

  const parsed = parseActivityForm(formData);
  if (!parsed.success) return { errors: toFieldErrors(parsed.error), message: "Проверьте поля формы." };

  const galleryFiles = formData.getAll("gallery").map(pickFile).filter((file): file is File => !!file);
  if (galleryFiles.length > MAX_GALLERY_FILES_PER_SAVE) {
    return { errors: { gallery: `За один раз можно добавить до ${MAX_GALLERY_FILES_PER_SAVE} фотографий.` } };
  }
  const removeIds = formData
    .getAll("removeGallery")
    .map((value) => idSchema.safeParse(value))
    .filter((result) => result.success)
    .map((result) => result.data);

  let card: string | null;
  let gallery: string[];
  try {
    const saved = await saveFiles([
      { file: pickFile(formData.get("cardImage")), kind: "photo" },
      ...galleryFiles.map((file) => ({ file, kind: "photo" as const })),
    ]);
    card = saved[0];
    gallery = saved.slice(1).filter((ref): ref is string => !!ref);
  } catch (error) {
    if (error instanceof UploadError) return { errors: { files: error.message }, message: error.message };
    throw error;
  }

  let removedRefs: string[] = [];
  try {
    if (activityId === null) {
      createActivity(db, id, parsed.data, card, gallery);
    } else {
      const cardChange = card ?? (formData.get("removeCard") === "on" ? null : undefined);
      const result = updateActivity(db, id, activityId, parsed.data, cardChange, { add: gallery, removeIds });
      if (!result) throw new Error("Услуга не найдена");
      removedRefs = result.removedRefs;
    }
  } catch (error) {
    // Транзакция откатилась — удаляем только что сохранённые файлы, чтобы не оставлять сирот.
    await removeUploads([card, ...gallery]);
    throw error;
  }
  // Старые файлы удаляются только после успешного commit.
  await deleteOrphanUploads(db, removedRefs);
  refreshAll();
  redirect(`/admin/events/${id}?activitySaved=1#activities`);
}

const activityRef = (formData: FormData) => ({
  eventId: idSchema.parse(text(formData, "eventId")),
  activityId: idSchema.parse(text(formData, "activityId")),
});

export async function toggleActivityAction(formData: FormData) {
  await requireAdmin();
  const { eventId, activityId } = activityRef(formData);
  setActivityActive(getDb(), eventId, activityId, text(formData, "active") === "1");
  refreshAll();
}

export async function moveActivityAction(formData: FormData) {
  await requireAdmin();
  const { eventId, activityId } = activityRef(formData);
  const direction = text(formData, "direction") === "up" ? "up" : "down";
  moveActivity(getDb(), eventId, activityId, direction);
  refreshAll();
}

export async function deleteActivityAction(formData: FormData) {
  await requireAdmin();
  const { eventId, activityId } = activityRef(formData);
  const db = getDb();
  const { imageRefs } = deleteActivity(db, eventId, activityId);
  await deleteOrphanUploads(db, imageRefs);
  refreshAll();
}

// ---------- Telegram ----------

export async function sendTestNotificationAction(): Promise<ActionState> {
  await requireAdmin();
  const config = readTelegramConfig();
  if (!config) return { message: "Telegram не настроен: задайте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в переменных окружения." };
  if (hitRateLimit("telegram-test", 5, 60 * 1000)) return { message: "Слишком много тестовых отправок. Подождите минуту." };

  const result = await sendTelegramMessage(config, TEST_MESSAGE);
  if (!result.ok) console.error(`Telegram: тестовое уведомление не отправлено (${result.reason}${result.status ? ` ${result.status}` : ""})`);
  // Администратору — только понятный итог, без ответа Telegram API и секретов.
  return { ok: result.ok, message: describeTestResult(result) };
}

/** Ручной повтор: ожидающие и исчерпавшие попытки уведомления (пачкой до 50). */
export async function retryNotificationsAction(): Promise<ActionState> {
  await requireAdmin();
  const config = readTelegramConfig();
  if (!config) return { message: "Telegram не настроен: задайте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в переменных окружения." };
  if (hitRateLimit("telegram-retry", 5, 60 * 1000)) return { message: "Слишком частые повторы. Подождите минуту." };

  const summary = await processPendingTelegramNotifications(getDb(), config, { includeFailed: true, limit: 50 });
  refreshAll();
  if (summary.processed === 0) return { ok: true, message: "Неотправленных уведомлений нет." };
  const failedNow = summary.retry + summary.failed;
  return {
    ok: failedNow === 0,
    message: failedNow === 0 ? `Отправлено уведомлений: ${summary.sent}.` : `Отправлено: ${summary.sent}. Не удалось отправить: ${failedNow} — проверьте связь с Telegram.`,
  };
}

// ---------- Общие настройки ----------

export async function saveSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse({
    paymentMethod: text(formData, "paymentMethod"),
    paymentPhone: text(formData, "paymentPhone"),
    paymentRecipient: text(formData, "paymentRecipient"),
    paymentTargetUrl: text(formData, "paymentTargetUrl"),
    communityTargetUrl: text(formData, "communityTargetUrl"),
    communityVkUrl: text(formData, "communityVkUrl"),
    communityMaxUrl: text(formData, "communityMaxUrl"),
    communityTitle: text(formData, "communityTitle"),
    communityDescription: text(formData, "communityDescription"),
  });
  if (!parsed.success) return { errors: toFieldErrors(parsed.error), message: "Проверьте поля формы." };

  // Если участнику показывается QR, он должен быть: уже загружен или выбран сейчас.
  const db = getDb();
  const newPaymentQr = pickFile(formData.get("paymentQr"));
  if (usesQr(parsed.data.paymentMethod) && !newPaymentQr && !getSettings(db).payment_qr_image) {
    return { errors: { paymentQr: "Загрузите QR-код оплаты — фото или скриншот." }, message: "Проверьте поля формы." };
  }

  let payment: string | null;
  let community: string | null;
  try {
    [payment, community] = await saveFiles([
      { file: newPaymentQr, kind: "qr" },
      { file: pickFile(formData.get("communityQr")), kind: "qr" },
    ]);
  } catch (error) {
    if (error instanceof UploadError) return { errors: { files: error.message }, message: error.message };
    throw error;
  }

  let replacedRefs: string[];
  try {
    ({ replacedRefs } = updateSettings(db, parsed.data, { payment: payment ?? undefined, community: community ?? undefined }));
  } catch (error) {
    await removeUploads([payment, community]);
    throw error;
  }
  await deleteOrphanUploads(db, replacedRefs);
  refreshAll();
  redirect("/admin/settings?saved=1");
}
