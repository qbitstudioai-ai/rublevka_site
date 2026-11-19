import Link from "next/link";
import { setEventStatusAction } from "@/app/admin/actions";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatEventSchedule } from "@/lib/format";
import { requireAdmin } from "@/lib/server/admin-auth";
import { getDb } from "@/lib/server/db";
import { listEventsWithCounts } from "@/lib/server/repo/events";

type PageProps = { searchParams: Promise<{ deleted?: string }> };

export default async function AdminEventsPage({ searchParams }: PageProps) {
  await requireAdmin();
  const { deleted } = await searchParams;
  const events = listEventsWithCounts(getDb());

  return (
    <div className="a-page">
      <div className="a-page-head">
        <div>
          <h1>Мероприятия</h1>
          <p className="a-hint">У каждого мероприятия своя ссылка на регистрацию. Черновики и архив участникам не видны.</p>
        </div>
        <Link className="a-button a-button-primary" href="/admin/events/new">
          Создать мероприятие
        </Link>
      </div>

      {deleted && (
        <p className="a-message is-ok" role="status">
          Мероприятие «{deleted.slice(0, 160)}» удалено вместе с услугами и регистрациями.
        </p>
      )}

      {events.length === 0 ? (
        <div className="a-empty">
          <p>Пока нет ни одного мероприятия.</p>
          <Link className="a-button a-button-primary" href="/admin/events/new">
            Создать первое мероприятие
          </Link>
        </div>
      ) : (
        <ul className="a-event-list">
          {events.map((event) => (
            <li key={event.id} className={`a-event-row${event.status === "archived" ? " is-archived" : ""}`}>
              <div className="a-event-main">
                <Link className="a-event-title" href={`/admin/events/${event.id}`}>
                  {event.title}
                </Link>
                <p className="a-event-meta">
                  {formatEventSchedule(event).line} · <StatusBadge status={event.status} />
                </p>
              </div>
              <div className="a-event-count">
                <strong>{event.registrations_count}</strong>
                <span>регистр.</span>
              </div>
              <div className="a-event-actions">
                {event.status === "published" ? (
                  <a className="a-link" href={`/meropriyatiya/event/${event.slug}`} target="_blank" rel="noopener noreferrer">
                    Открыть страницу
                  </a>
                ) : (
                  <span className="a-link is-muted">/event/{event.slug}</span>
                )}
                <Link className="a-button a-button-secondary" href={`/admin/events/${event.id}`}>
                  Редактировать
                </Link>
                {event.status !== "archived" ? (
                  <form action={setEventStatusAction}>
                    <input type="hidden" name="eventId" value={event.id} />
                    <input type="hidden" name="status" value="archived" />
                    <button className="a-button a-button-quiet" type="submit" aria-label={`Архивировать «${event.title}»`}>
                      Архивировать
                    </button>
                  </form>
                ) : (
                  <form action={setEventStatusAction}>
                    <input type="hidden" name="eventId" value={event.id} />
                    <input type="hidden" name="status" value="draft" />
                    <button className="a-button a-button-quiet" type="submit" aria-label={`Вернуть «${event.title}» в черновики`}>
                      Вернуть в черновики
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
