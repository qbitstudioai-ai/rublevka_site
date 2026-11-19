import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import {
  activities,
  events,
  registrationActivities,
  registrations,
} from "./schema";

export class GuestError extends Error {}
const guestInput = z.object({
  eventId: z.uuid(),
  requestId: z.uuid(),
  name: z
    .string()
    .trim()
    .min(2)
    .max(160)
    .regex(/^[\p{L}][\p{L}\p{M} .'’\-]+$/u),
  phone: z
    .string()
    .trim()
    .min(7)
    .max(32)
    .regex(/^\+?[\d ()-]+$/)
    .transform((value) => value.replace(/\D/g, ""))
    .pipe(z.string().regex(/^\d{10,15}$/)),
  messenger: z.string().trim().max(160).optional(),
  consent: z.literal(true),
  termsVersion: z.number().int().nonnegative(),
  groupSize: z.number().int().min(1).max(1000000).optional(),
  activityIds: z.array(z.uuid()).max(100),
});
type GuestInput = Omit<z.input<typeof guestInput>, "consent"> & {
  consent: boolean;
};
const receiptFields = {
  id: registrations.id,
  name: registrations.name,
  total: registrations.total,
  hasQuote: registrations.hasQuote,
  groupSize: registrations.groupSize,
  eventPrice: registrations.eventPrice,
};
const serviceFields = {
  title: registrationActivities.title,
  price: registrationActivities.price,
  priceSuffix: registrationActivities.priceSuffix,
  startsAt: registrationActivities.startsAt,
  position: registrationActivities.position,
};
const occupiedPlaces =
  sql<number>`coalesce(sum(${registrations.groupSize}), 0)`.mapWith(Number);
const consentVersion = "events-test-v1";

export async function registerGuest(input: GuestInput) {
  const parsed = guestInput.safeParse(input);
  if (!parsed.success)
    throw new GuestError(
      "Проверьте имя, телефон, выбранные активности и согласие с условиями.",
    );
  const guest = parsed.data;
  const selectedIds = new Set(guest.activityIds);
  if (selectedIds.size !== guest.activityIds.length)
    throw new GuestError("Каждую активность можно выбрать один раз.");
  const messenger = guest.messenger || null;
  return db.transaction(async (tx) => {
    // This lock is shared by registration and administrative edits to the event.
    // Read capacity and activity rows only after acquiring it under READ COMMITTED.
    const [event] = await tx
      .select()
      .from(events)
      .where(eq(events.id, guest.eventId))
      .for("update");
    if (!event) throw new GuestError("Мероприятие недоступно.");
    const groupSize = guest.groupSize ?? 1;
    const [previous] = await tx
      .select()
      .from(registrations)
      .where(
        and(
          eq(registrations.eventId, event.id),
          eq(registrations.requestId, guest.requestId),
        ),
      );
    if (previous) {
      const chosen = await tx
        .select({ id: registrationActivities.activityId, ...serviceFields })
        .from(registrationActivities)
        .where(eq(registrationActivities.registrationId, previous.id))
        .orderBy(
          asc(registrationActivities.position),
          asc(registrationActivities.startsAt),
          asc(registrationActivities.title),
          asc(registrationActivities.activityId),
        );
      if (
        previous.groupSize !== groupSize ||
        previous.phone !== guest.phone ||
        previous.name !== guest.name ||
        previous.messenger !== messenger ||
        chosen.length !== selectedIds.size ||
        chosen.some((a) => !selectedIds.has(a.id))
      )
        throw new GuestError(
          "Параметры повторного обращения изменились. Обновите страницу.",
        );
      if (previous.status === "cancelled")
        throw new GuestError("Эта заявка отменена.");
      const { id, name, total, hasQuote, eventPrice } = previous;
      return {
        id,
        name,
        total,
        hasQuote,
        groupSize,
        eventPrice,
        services: chosen.map(
          ({ title, price, priceSuffix, startsAt, position }) => ({
            title,
            price,
            priceSuffix,
            startsAt,
            position,
          }),
        ),
      };
    }

    if (
      (event.group && guest.groupSize === undefined) ||
      (!event.group && groupSize !== 1)
    )
      throw new GuestError("Проверьте количество участников.");
    if (
      !event.termsVerifiedAt ||
      event.reviewNote ||
      event.status !== "open" ||
      event.startsAt.getTime() <= Date.now()
    )
      throw new GuestError("Регистрация на это мероприятие закрыта.");
    if (guest.termsVersion !== event.termsVerifiedAt.getTime())
      throw new GuestError(
        "Условия участия изменились. Обновите страницу и проверьте итоговую стоимость.",
      );
    const counted = and(
      eq(registrations.eventId, event.id),
      ne(registrations.status, "cancelled"),
    );
    if (event.capacity !== null) {
      const [used] = await tx
        .select({ places: occupiedPlaces })
        .from(registrations)
        .where(counted);
      if (used.places + groupSize > event.capacity)
        throw new GuestError("Свободных мест на мероприятие больше нет.");
    }
    const options = await tx
      .select()
      .from(activities)
      .where(eq(activities.eventId, event.id))
      .orderBy(
        asc(activities.position),
        asc(activities.startsAt),
        asc(activities.title),
        asc(activities.id),
      );
    const chosen = options.filter((option) => selectedIds.has(option.id));
    if (
      chosen.length !== selectedIds.size ||
      chosen.some((option) => !option.available)
    )
      throw new GuestError("Одна из выбранных активностей недоступна.");
    if (
      options.some((option) => option.required && !selectedIds.has(option.id))
    )
      throw new GuestError("Выберите обязательную активность.");
    const limited = chosen.filter((option) => option.capacity !== null);
    if (limited.length) {
      const counts = await tx
        .select({
          id: registrationActivities.activityId,
          places: occupiedPlaces,
        })
        .from(registrationActivities)
        .innerJoin(
          registrations,
          eq(registrations.id, registrationActivities.registrationId),
        )
        .where(
          and(
            counted,
            inArray(
              registrationActivities.activityId,
              limited.map((option) => option.id),
            ),
          ),
        )
        .groupBy(registrationActivities.activityId);
      const taken = new Map(counts.map((row) => [row.id, row.places]));
      if (
        limited.some(
          (option) =>
            (taken.get(option.id) ?? 0) + groupSize > option.capacity!,
        )
      )
        throw new GuestError("На выбранную активность больше нет мест.");
    }
    const total = chosen.reduce(
      (sum, option) => sum + (option.price ?? 0),
      event.price ?? 0,
    );
    const hasQuote =
      event.price === null || chosen.some((option) => option.price === null);
    const [receipt] = await tx
      .insert(registrations)
      .values({
        eventId: event.id,
        requestId: guest.requestId,
        name: guest.name,
        phone: guest.phone,
        messenger,
        groupSize,
        eventPrice: event.price,
        consentVersion,
        total,
        hasQuote,
      })
      .returning(receiptFields);
    const services = chosen.map(
      ({ title, price, priceSuffix, startsAt, position }) => ({
        title,
        price,
        priceSuffix,
        startsAt,
        position,
      }),
    );
    if (services.length)
      await tx.insert(registrationActivities).values(
        services.map((service, index) => ({
          ...service,
          registrationId: receipt.id,
          activityId: chosen[index].id,
        })),
      );
    return { ...receipt, services };
  });
}
