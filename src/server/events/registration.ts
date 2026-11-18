import { and, count, eq, inArray, ne } from "drizzle-orm";
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
};
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
        .select({ id: registrationActivities.activityId })
        .from(registrationActivities)
        .where(eq(registrationActivities.registrationId, previous.id));
      if (
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
      const { id, name, total, hasQuote } = previous;
      return { id, name, total, hasQuote };
    }

    if (event.status !== "open" || event.startsAt.getTime() <= Date.now())
      throw new GuestError("Регистрация на это мероприятие закрыта.");
    const counted = and(
      eq(registrations.eventId, event.id),
      ne(registrations.status, "cancelled"),
    );
    if (event.capacity !== null) {
      const [used] = await tx
        .select({ places: count() })
        .from(registrations)
        .where(counted);
      if (used.places >= event.capacity)
        throw new GuestError("Свободных мест на мероприятие больше нет.");
    }
    const options = await tx
      .select()
      .from(activities)
      .where(eq(activities.eventId, event.id));
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
        .select({ id: registrationActivities.activityId, places: count() })
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
          (option) => (taken.get(option.id) ?? 0) >= option.capacity!,
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
        consentVersion,
        total,
        hasQuote,
      })
      .returning(receiptFields);
    if (chosen.length)
      await tx.insert(registrationActivities).values(
        chosen.map((option) => ({
          registrationId: receipt.id,
          activityId: option.id,
          title: option.title,
          price: option.price,
        })),
      );
    return receipt;
  });
}
