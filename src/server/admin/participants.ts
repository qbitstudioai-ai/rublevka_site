import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../events/db";
import { registrations, registrationActivities } from "../events/schema";

export async function participants(
  eventId: string,
  query = "",
  page = 0,
  limit = 50,
) {
  const digits = query.replace(/\D/g, "");
  const filter = query
    ? sql`(strpos(lower(${registrations.name}),lower(${query})) > 0 or (${digits} <> '' and strpos(${registrations.phone},${digits}) > 0))`
    : undefined;
  const rows = await db
    .select({
      id: registrations.id,
      name: registrations.name,
      phone: registrations.phone,
      messenger: registrations.messenger,
      status: registrations.status,
      paymentStatus: registrations.paymentStatus,
      total: registrations.total,
      hasQuote: registrations.hasQuote,
      activities: sql<string[]>`array(select ${registrationActivities.title}
        from ${registrationActivities}
        where ${registrationActivities.registrationId} = ${registrations.id}
        order by ${registrationActivities.title})`,
    })
    .from(registrations)
    .where(and(eq(registrations.eventId, eventId), filter))
    .orderBy(desc(registrations.createdAt), registrations.id)
    .limit(limit)
    .offset(page * limit);
  return rows;
}
export type ParticipantRow = Awaited<ReturnType<typeof participants>>[number];
