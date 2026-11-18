import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/server/events/db";
import { events, activities } from "@/server/events/schema";
import { requireAdmin } from "@/server/admin/session";
import { uuidPattern } from "@/server/admin/input";
import { participants } from "@/server/admin/participants";
import { ActivityEditor, EventEditor } from "../editors";
import { Guests } from "../guests";
import { displayDate, eventStates } from "../labels";
export default async function ManageEvent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin(),
    { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const [event] = await db.select().from(events).where(eq(events.id, id));
  if (!event) notFound();
  const [items, rows] = await Promise.all([
    db
      .select()
      .from(activities)
      .where(eq(activities.eventId, id))
      .orderBy(asc(activities.startsAt), activities.title),
    participants(id),
  ]);
  return (
    <>
      <Link href="/admin/meropriyatiya">← Все мероприятия</Link>
      <header className="office-head">
        <div>
          <h1>{event.title}</h1>
          <p>
            {displayDate(event.startsAt)} · {eventStates[event.status]}
          </p>
        </div>
      </header>
      <details className="office-fold">
        <summary>Редактировать мероприятие</summary>
        <EventEditor event={event} />
      </details>
      <details className="office-fold">
        <summary>Дополнительные активности ({items.length})</summary>
        {items.map((a) => (
          <details className="office-fold" key={a.id}>
            <summary>{a.title}</summary>
            <ActivityEditor eventId={id} activity={a} />
          </details>
        ))}
        <details className="office-fold">
          <summary>Добавить активность</summary>
          <ActivityEditor eventId={id} />
        </details>
      </details>
      <section className="office-section">
        <div className="office-head">
          <h2>Участники</h2>
          {user.role === "admin" && (
            <form method="post" action={"/admin/meropriyatiya/" + id + "/csv"}>
              <button>Скачать CSV</button>
            </form>
          )}
        </div>
        <Guests key={id} initial={rows} eventId={id} isAdmin={user.role === "admin"} />
      </section>
    </>
  );
}
