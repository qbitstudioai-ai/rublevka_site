import { cache } from "react";
import { and, asc, count, eq, gt, ne, or, sql } from "drizzle-orm";
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
    .select(publicFields)
    .from(events)
    .where(and(eq(events.slug, slug), published(new Date())))
    .limit(1);
  if (!event) return null;
  const [options, counts] = await Promise.all([
    db
      .select({
        id: activities.id,
        title: activities.title,
        description: activities.description,
        imageId: activities.imageId,
        startsAt: activities.startsAt,
        price: activities.price,
        required: activities.required,
        available: activities.available,
        capacity: activities.capacity,
        reserved:
          sql<number>`(select count(*) from ${registrationActivities} join ${registrations} on ${registrations.id} = ${registrationActivities.registrationId}
        where ${registrationActivities.activityId} = ${activities.id} and ${registrations.status} <> 'cancelled')`.mapWith(
            Number,
          ),
      })
      .from(activities)
      .where(eq(activities.eventId, event.id))
      .orderBy(asc(activities.startsAt), asc(activities.title)),
    db
      .select({ reserved: count() })
      .from(registrations)
      .where(
        and(
          eq(registrations.eventId, event.id),
          ne(registrations.status, "cancelled"),
        ),
      ),
  ]);
  const now = new Date();
  const choices = options.map(
    ({ capacity, reserved, available, ...fields }) => ({
      ...fields,
      available: available && (capacity === null || reserved < capacity),
    }),
  );
  const full =
    (event.capacity !== null && counts[0].reserved >= event.capacity) ||
    choices.some((choice) => choice.required && !choice.available);
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
  return { ...event, status, options: choices };
});
