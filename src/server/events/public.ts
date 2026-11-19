import { cache } from "react";
import { and, asc, eq, gt, isNotNull, ne, or, sql } from "drizzle-orm";
import { db } from "./db";
import {
  activities,
  events,
  registrations,
  registrationActivities,
} from "./schema";

function published(now: Date) {
  return and(
    ne(events.status, "draft"),
    isNotNull(events.termsVerifiedAt),
    eq(events.reviewNote, ""),
    or(
      eq(events.archive, true),
      and(gt(events.endsAt, now), ne(events.status, "completed")),
    ),
  );
}
const publicFields = {
  id: events.id,
  slug: events.slug,
  title: events.title,
  description: events.description,
  program: events.program,
  conditions: events.conditions,
  imageId: events.imageId,
  startsAt: events.startsAt,
  endsAt: events.endsAt,
  price: events.price,
  status: events.status,
  group: events.group,
  capacity: events.capacity,
};
export async function listPublishedEvents() {
  if (!process.env.DATABASE_URL) return [];
  return db
    .select(publicFields)
    .from(events)
    .where(published(new Date()))
    .orderBy(asc(events.startsAt));
}
export type ListedEvent = Awaited<
  ReturnType<typeof listPublishedEvents>
>[number];
export function pastEvent(event: ListedEvent, now: Date) {
  return event.status === "completed" || event.endsAt <= now;
}
export const loadPublicEvent = cache(async (slug: string) => {
  if (!process.env.DATABASE_URL) return null;
  const [event] = await db
    .select({ ...publicFields, termsVerifiedAt: events.termsVerifiedAt })
    .from(events)
    .where(and(eq(events.slug, slug), published(new Date())))
    .limit(1);
  if (!event?.termsVerifiedAt) return null;
  const { termsVerifiedAt, ...publicEvent } = event;
  const serviceReservations = db
    .select({
      activityId: registrationActivities.activityId,
      reserved: sql<number>`sum(${registrations.groupSize})`.as("reserved"),
    })
    .from(registrationActivities)
    .innerJoin(
      registrations,
      eq(registrations.id, registrationActivities.registrationId),
    )
    .where(
      and(
        eq(registrations.eventId, event.id),
        ne(registrations.status, "cancelled"),
      ),
    )
    .groupBy(registrationActivities.activityId)
    .as("service_reservations");
  const [options, counts] = await Promise.all([
    db
      .select({
        id: activities.id,
        title: activities.title,
        description: activities.description,
        longDescription: activities.longDescription,
        details: activities.details,
        durationText: activities.durationText,
        priceSuffix: activities.priceSuffix,
        galleryIds: activities.galleryIds,
        position: activities.position,
        imageId: activities.imageId,
        startsAt: activities.startsAt,
        price: activities.price,
        required: activities.required,
        available: activities.available,
        capacity: activities.capacity,
        reserved:
          sql<number>`coalesce(${serviceReservations.reserved}, 0)`.mapWith(
            Number,
          ),
      })
      .from(activities)
      .leftJoin(
        serviceReservations,
        eq(serviceReservations.activityId, activities.id),
      )
      .where(eq(activities.eventId, event.id))
      .orderBy(
        asc(activities.position),
        asc(activities.startsAt),
        asc(activities.title),
      ),
    db
      .select({
        reserved:
          sql<number>`coalesce(sum(${registrations.groupSize}), 0)`.mapWith(
            Number,
          ),
      })
      .from(registrations)
      .where(
        and(
          eq(registrations.eventId, event.id),
          ne(registrations.status, "cancelled"),
        ),
      ),
  ]);
  const now = new Date();
  const choices = options
    .filter((option) => option.available)
    .map(({ capacity, reserved, ...fields }) => ({
      ...fields,
      available: capacity === null || reserved < capacity,
    }));
  const full =
    (event.capacity !== null && counts[0].reserved >= event.capacity) ||
    options.some(
      ({ required, available, capacity, reserved }) =>
        required && (!available || (capacity !== null && reserved >= capacity)),
    );
  const status: ListedEvent["status"] =
    event.status === "cancelled"
      ? "cancelled"
      : pastEvent(event, now)
        ? "completed"
        : event.status === "open" && event.startsAt <= now
          ? "closed"
          : event.status === "open" && full
            ? "full"
            : event.status;
  return {
    ...publicEvent,
    termsVersion: termsVerifiedAt.getTime(),
    status,
    options: choices,
  };
});
