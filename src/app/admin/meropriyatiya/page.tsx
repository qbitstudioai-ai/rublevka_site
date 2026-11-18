import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/server/events/db";
import { events } from "@/server/events/schema";
import { requireAdmin } from "@/server/admin/session";
import { logout } from "../session-actions";
import { displayDate, eventStates } from "./labels";
export default async function EventOffice() {
  const user = await requireAdmin();
  const all = await db
    .select({
      id: events.id,
      title: events.title,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      status: events.status,
    })
    .from(events)
    .orderBy(asc(events.startsAt));
  const now = new Date(),
    upcoming = all.filter((e) => e.endsAt >= now && e.status !== "completed"),
    past = all
      .filter((e) => e.endsAt < now || e.status === "completed")
      .reverse();
  return (
    <>
      <header className="office-head">
        <div>
          <p>
            {user.role === "admin" ? "Администратор" : "Менеджер мероприятий"} ·{" "}
            {user.login}
          </p>
          <h1>Мероприятия</h1>
        </div>
        <form action={logout}>
          <button>Выйти</button>
        </form>
      </header>
      <nav className="office-tools" aria-label="Управление">
        <Link className="office-primary" href="/admin/meropriyatiya/new">
          Создать мероприятие
        </Link>
        <Link href="/meropriyatiya">Публичная афиша ↗</Link>
      </nav>
      {(
        [
          ["Предстоящие", upcoming],
          ["Прошедшие", past],
        ] as const
      ).map(([title, group]) => (
        <section className="office-section" key={title}>
          <h2>{title}</h2>
          {group.length ? (
            <ul className="office-index">
              {group.map((e) => (
                <li key={e.id}>
                  <Link href={"/admin/meropriyatiya/" + e.id}>
                    <span>{displayDate(e.startsAt)}</span>
                    <strong>{e.title}</strong>
                    <small>{eventStates[e.status]}</small>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>Событий пока нет.</p>
          )}
        </section>
      ))}
    </>
  );
}
