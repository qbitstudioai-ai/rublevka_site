"use server";
import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/events/db";
import { mediaCatalog } from "@/content/media";
import {
  events,
  activities,
  registrations,
  registrationActivities,
  auditLogs,
  eventStatus,
  paymentStatus,
  registrationStatus,
} from "@/server/events/schema";
import { sameOrigin, requireAdmin } from "@/server/admin/session";
import {
  amount,
  capacityValue,
  choice,
  dateValue,
  imageValue,
  InputError,
  revision,
  textValue,
  uuidPattern,
} from "@/server/admin/input";
import { participants } from "@/server/admin/participants";
import type { FormState } from "../form";
const base = "/admin/meropriyatiya";
const occupiedPlaces =
  sql<number>`coalesce(sum(${registrations.groupSize}), 0)`.mapWith(Number);
function verifyTerms(form: FormData) {
  if (form.get("verifiedTerms") !== "yes")
    throw new InputError("Подтвердите проверку программы, условий и цен.");
}
function nextVerification(previous: Date | null) {
  return new Date(Math.max(Date.now(), (previous?.getTime() ?? 0) + 1));
}
function gallerySelection(form: FormData) {
  const photos = [...new Set(form.getAll("galleryIds").filter(Boolean))];
  if (
    photos.length > 8 ||
    photos.some(
      (photo) =>
        typeof photo !== "string" || !Object.hasOwn(mediaCatalog, photo),
    )
  )
    throw new InputError("Выберите до восьми изображений из каталога.");
  return photos as string[];
}
function activityPosition(form: FormData) {
  const value = textValue(form, "position", 5);
  if (value && !/^\d+$/.test(value))
    throw new InputError(
      "Порядок показа должен быть целым числом от 0 до 99 999.",
    );
  return Number(value);
}
function idField(f: FormData, name: string) {
  const id = textValue(f, name, 50);
  if (id && !uuidPattern.test(id))
    throw new InputError("Некорректный идентификатор.");
  return id;
}
function failed(err: unknown) {
  return {
    message:
      err instanceof InputError
        ? err.message
        : "Изменения не сохранены. Проверьте поля, адрес события и соединение.",
  };
}
function fresh(f: FormData, record: unknown) {
  if (revision(record) !== f.get("revision"))
    throw new InputError(
      "Запись изменилась. Обновите страницу перед редактированием.",
    );
}

export async function saveEvent(
  _state: FormState,
  f: FormData,
): Promise<FormState> {
  const user = await requireAdmin();
  if (!(await sameOrigin())) return { message: "Недопустимый источник формы." };
  let created = "";
  try {
    const id = idField(f, "id"),
      title = textValue(f, "title", 180),
      slug = textValue(f, "slug", 100),
      startsAt = dateValue(f, "startsAt"),
      endsAt = dateValue(f, "endsAt"),
      imageId = imageValue(f);
    const status = choice(f, "status", eventStatus.enumValues),
      program = textValue(f, "program", 30000),
      description = textValue(f, "description", 1000),
      reviewNote = textValue(f, "reviewNote", 4000);
    if (
      !title ||
      !imageId ||
      !startsAt ||
      !endsAt ||
      endsAt < startsAt ||
      !/^([a-z0-9]+-)*[a-z0-9]+$/.test(slug)
    )
      throw new InputError("Проверьте название, адрес, обложку и даты.");
    if (status !== "draft" && (!description || !program || reviewNote))
      throw new InputError(
        "Перед публикацией заполните описание и программу, проверьте и снимите редакционные замечания.",
      );
    if (status !== "draft") verifyTerms(f);
    if (status === "open" && startsAt <= new Date())
      throw new InputError("Регистрация возможна только до начала события.");
    const data = {
      title,
      slug,
      startsAt,
      endsAt,
      imageId,
      program,
      description,
      status,
      reviewNote,
      conditions: textValue(f, "conditions", 5000),
      price: amount(f, "price"),
      capacity: capacityValue(f),
      group: f.has("group"),
      archive: f.has("archive"),
    };
    await db.transaction(async (tx) => {
      let target = id;
      if (id) {
        const [before] = await tx
          .select()
          .from(events)
          .where(eq(events.id, id))
          .for("update");
        if (!before) throw new InputError("Событие не найдено.");
        fresh(f, before);
        const [occupied] = await tx
          .select({ value: occupiedPlaces })
          .from(registrations)
          .where(
            and(
              eq(registrations.eventId, id),
              ne(registrations.status, "cancelled"),
            ),
          );
        if (data.capacity !== null && data.capacity < occupied.value)
          throw new InputError(
            "Лимит меньше числа зарегистрированных участников.",
          );
        const options = await tx
          .select({ startsAt: activities.startsAt })
          .from(activities)
          .where(
            and(eq(activities.eventId, id), eq(activities.available, true)),
          );
        if (
          options.some(
            (a) => a.startsAt && (a.startsAt < startsAt || a.startsAt > endsAt),
          )
        )
          throw new InputError(
            "Время активности выходит за новые границы события.",
          );
        await tx
          .update(events)
          .set({
            ...data,
            termsVerifiedAt:
              status === "draft"
                ? null
                : nextVerification(before.termsVerifiedAt),
          })
          .where(eq(events.id, id));
      } else {
        const [row] = await tx
          .insert(events)
          .values({
            ...data,
            termsVerifiedAt: status === "draft" ? null : nextVerification(null),
          })
          .returning({ id: events.id });
        target = row.id;
        created = row.id;
      }
      await tx.insert(auditLogs).values({
        adminId: user.id,
        action: id ? "event.update" : "event.create",
        targetId: target,
      });
    });
  } catch (err) {
    return failed(err);
  }
  revalidatePath(base);
  revalidatePath("/meropriyatiya");
  revalidatePath("/meropriyatiya/[slug]", "page");
  if (created) redirect(base + "/" + created);
  revalidatePath(base + "/" + f.get("id"));
  return { message: "Событие сохранено.", ok: true };
}
export async function saveActivity(
  _state: FormState,
  f: FormData,
): Promise<FormState> {
  const user = await requireAdmin();
  if (!(await sameOrigin())) return { message: "Недопустимый источник формы." };
  try {
    const id = idField(f, "id"),
      eventId = idField(f, "eventId"),
      title = textValue(f, "title", 180);
    if (!title || !eventId)
      throw new InputError("Укажите название активности.");
    const data = {
      eventId,
      title,
      description: textValue(f, "description", 3000),
      longDescription: textValue(f, "longDescription", 3000),
      details: textValue(f, "details", 2000),
      durationText: textValue(f, "durationText", 80),
      priceSuffix: textValue(f, "priceSuffix", 80),
      galleryIds: gallerySelection(f),
      position: activityPosition(f),
      imageId: imageValue(f),
      startsAt: dateValue(f, "startsAt"),
      capacity: capacityValue(f),
      price: amount(f, "price"),
      available: f.has("available"),
      required: f.has("required"),
    };
    if (data.required && !data.available)
      throw new InputError("Обязательная активность должна быть доступна.");
    await db.transaction(async (tx) => {
      const [event] = await tx
        .select()
        .from(events)
        .where(eq(events.id, eventId))
        .for("update");
      if (!event) throw new InputError("Событие не найдено.");
      if (event.status !== "draft") verifyTerms(f);
      if (
        data.startsAt &&
        (data.startsAt < event.startsAt || data.startsAt > event.endsAt)
      )
        throw new InputError(
          "Время активности должно входить в программу события.",
        );
      let target = id;
      if (id) {
        const [before] = await tx
          .select()
          .from(activities)
          .where(and(eq(activities.eventId, eventId), eq(activities.id, id)));
        if (!before) throw new InputError("Активность не найдена.");
        fresh(f, before);
        const [occupied] = await tx
          .select({ value: occupiedPlaces })
          .from(registrationActivities)
          .innerJoin(
            registrations,
            eq(registrations.id, registrationActivities.registrationId),
          )
          .where(
            and(
              eq(registrationActivities.activityId, id),
              ne(registrations.status, "cancelled"),
            ),
          );
        if (data.capacity !== null && data.capacity < occupied.value)
          throw new InputError(
            "Лимит меньше числа записавшихся на активность.",
          );
        await tx.update(activities).set(data).where(eq(activities.id, id));
      } else {
        const [row] = await tx
          .insert(activities)
          .values(data)
          .returning({ id: activities.id });
        target = row.id;
      }
      if (event.termsVerifiedAt) {
        await tx
          .update(events)
          .set({ termsVerifiedAt: nextVerification(event.termsVerifiedAt) })
          .where(eq(events.id, event.id));
      }
      await tx.insert(auditLogs).values({
        adminId: user.id,
        action: id ? "activity.update" : "activity.create",
        targetId: target,
      });
    });
    revalidatePath(base + "/" + eventId);
    revalidatePath("/meropriyatiya/[slug]", "page");
  } catch (err) {
    return failed(err);
  }
  return { message: "Активность сохранена.", ok: true };
}
export async function updateParticipant(
  _state: FormState,
  f: FormData,
): Promise<FormState> {
  const user = await requireAdmin();
  if (!(await sameOrigin())) return { message: "Недопустимый источник формы." };
  try {
    const id = idField(f, "id"),
      eventId = idField(f, "eventId"),
      status = choice(f, "status", registrationStatus.enumValues);
    await db.transaction(async (tx) => {
      await tx
        .select({ id: events.id })
        .from(events)
        .where(eq(events.id, eventId))
        .for("update");
      const [row] = await tx
        .select()
        .from(registrations)
        .where(
          and(eq(registrations.eventId, eventId), eq(registrations.id, id)),
        )
        .for("update");
      if (!row) throw new InputError("Регистрация не найдена.");
      if (
        row.status !== f.get("beforeStatus") ||
        row.paymentStatus !== f.get("beforePayment")
      )
        throw new InputError("Статус изменился. Обновите список.");
      if (row.status === "cancelled" && status !== "cancelled")
        throw new InputError(
          "Место освобождено. Для участия нужна новая регистрация.",
        );
      if (f.has("paymentStatus") && user.role !== "admin")
        throw new InputError("Изменение оплаты доступно администратору.");
      const payment =
        user.role === "admin"
          ? choice(f, "paymentStatus", paymentStatus.enumValues)
          : row.paymentStatus;
      await tx
        .update(registrations)
        .set({ status, paymentStatus: payment })
        .where(eq(registrations.id, id));
      await tx.insert(auditLogs).values({
        adminId: user.id,
        action:
          "registration." +
          row.status +
          "." +
          status +
          "." +
          row.paymentStatus +
          "." +
          payment,
        targetId: id,
      });
    });
    revalidatePath(base + "/" + eventId);
  } catch (err) {
    return failed(err);
  }
  return { message: "Изменения сохранены.", ok: true };
}
export async function searchParticipants(
  eventId: string,
  query: string,
  page: number,
) {
  await requireAdmin();
  if (
    !(await sameOrigin()) ||
    !uuidPattern.test(eventId) ||
    typeof query !== "string" ||
    query.length > 100 ||
    !Number.isSafeInteger(page) ||
    page < 0 ||
    page > 100000
  )
    return [];
  try {
    return await participants(eventId, query.trim(), page);
  } catch {
    // ORM errors may carry the bound search value (name or phone).
    throw new Error("Не удалось загрузить список.");
  }
}
