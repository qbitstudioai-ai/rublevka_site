import Link from "next/link";
import { notFound } from "next/navigation";
import {
  deleteActivityAction,
  deleteEventAction,
  deleteRegistrationsAction,
  moveActivityAction,
  setEventStatusAction,
  toggleActivityAction,
  updateEventAction,
} from "@/app/admin/actions";
import { DeleteEventForm, DeleteRegistrationsForm } from "@/components/admin/DangerZone";
import { EventForm } from "@/components/admin/EventForm";
import { ConfirmSubmit, CopyLinkButton } from "@/components/admin/FormParts";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatDateTime, isPastEvent } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { formatRub, kopecksToInput, priceText } from "@/lib/money";
import { requireAdmin } from "@/lib/server/admin-auth";
import { getDb } from "@/lib/server/db";
import { getOrigin } from "@/lib/server/origin";
import { listActivities } from "@/lib/server/repo/activities";
import { getEventById } from "@/lib/server/repo/events";
import { countRegistrations, listRegistrations } from "@/lib/server/repo/registrations";
import { idSchema } from "@/lib/server/validation";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; created?: string; saved?: string; activitySaved?: string; registrationsDeleted?: string }>;
};

export default async function AdminEventPage({ params, searchParams }: PageProps) {
  await requireAdmin();
  const parsedId = idSchema.safeParse((await params).id);
  if (!parsedId.success) notFound();
  const { q = "", created, saved, activitySaved, registrationsDeleted } = await searchParams;
  const query = q.slice(0, 100);

  const db = getDb();
  const event = getEventById(db, parsedId.data);
  if (!event) notFound();
  const activities = listActivities(db, event.id);
  const totalRegistrations = countRegistrations(db, event.id);
  const registrations = listRegistrations(db, event.id, query);
  const origin = await getOrigin();
  const publicUrl = `${origin}/event/${event.slug}`;

  return (
    <div className="a-page">
      <Link className="a-back" href="/admin">
        ← Все мероприятия
      </Link>
      <div className="a-page-head">
        <div>
          <h1>{event.title}</h1>
          <p className="a-event-meta">
            <StatusBadge status={event.status} />
          </p>
        </div>
        {event.status !== "published" ? (
          <form action={setEventStatusAction}>
            <input type="hidden" name="eventId" value={event.id} />
            <input type="hidden" name="status" value="published" />
            <button className="a-button a-button-primary" type="submit">
              Опубликовать
            </button>
          </form>
        ) : (
          <form action={setEventStatusAction}>
            <input type="hidden" name="eventId" value={event.id} />
            <input type="hidden" name="status" value="archived" />
            <button className="a-button a-button-secondary" type="submit">
              Архивировать
            </button>
          </form>
        )}
      </div>

      {created && (
        <p className="a-message is-ok" role="status">
          Мероприятие создано. Добавьте услуги и опубликуйте, когда всё будет готово.
        </p>
      )}

      {saved && (
        <p className="a-message is-ok" role="status">
          Изменения сохранены.
        </p>
      )}

      <div className="a-public-link">
        <span className="a-label">Публичная ссылка</span>
        <span className="a-url" data-testid="public-url">
          {publicUrl}
        </span>
        <div className="a-public-link-actions">
          <CopyLinkButton url={publicUrl} />
          {event.status === "published" ? (
            <a className="a-button a-button-quiet" href={`/meropriyatiya/event/${event.slug}`} target="_blank" rel="noopener noreferrer">
              Открыть
            </a>
          ) : (
            <span className="a-hint">Ссылка заработает после публикации.</span>
          )}
        </div>
        {event.status === "published" && isPastEvent(event.event_date) && (
          <p className="a-hint" data-testid="event-past-hint">
            Дата мероприятия прошла: на главной его больше нет, а по ссылке участники видят «Регистрация закрыта». Чтобы снова открыть регистрацию, измените дату.
          </p>
        )}
      </div>

      <nav className="a-section-nav" aria-label="Разделы мероприятия">
        <a href="#main">Основное</a>
        <a href="#activities">Услуги · {activities.length}</a>
        <a href="#registrations">Регистрации · {totalRegistrations}</a>
        <a href="#cleanup">Удаление данных</a>
      </nav>

      <section className="a-section" id="main" aria-labelledby="main-title">
        <h2 id="main-title">Основное</h2>
        <div className="a-section-body a-page-narrow">
          <EventForm
            key={event.updated_at}
            mode="edit"
            origin={origin}
            action={updateEventAction.bind(null, event.id)}
            initial={{
              title: event.title,
              slug: event.slug,
              eventDate: event.event_date,
              startTime: event.start_time,
              endDate: event.end_date ?? "",
              endTime: event.end_time ?? "",
              heroFit: event.hero_fit,
              price: kopecksToInput(event.price_kopecks),
              extraInfo: event.extra_info,
              longDescription: event.long_description,
              shortDescription: event.short_description,
              locationText: event.location_text ?? "",
              status: event.status,
              heroSrc: mediaUrl(event.hero_image),
            }}
          />
        </div>
      </section>

      <section className="a-section" id="activities" aria-labelledby="activities-title">
        <div className="a-section-head">
          <h2 id="activities-title">Услуги</h2>
          <Link className="a-button a-button-primary" href={`/admin/events/${event.id}/activities/new`}>
            Добавить услугу
          </Link>
        </div>
        {activitySaved && (
          <p className="a-message is-ok" role="status">
            Услуга сохранена.
          </p>
        )}
        {activities.length === 0 ? (
          <p className="a-empty">Услуг пока нет. Регистрация работает и без них.</p>
        ) : (
          <ol className="a-activity-list">
            {activities.map((activity, index) => {
              const image = mediaUrl(activity.card_image);
              return (
                <li key={activity.id} className={`a-activity-row${activity.is_active ? "" : " is-off"}`} data-testid="admin-activity">
                  <div className="a-activity-thumb">
                    {image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt="" />
                    )}
                  </div>
                  <div className="a-activity-info">
                    <strong>{activity.title}</strong>
                    <span>
                      {priceText(activity.pricing_type, activity.fixed_price_kopecks, activity.price_suffix)}
                      {activity.start_time ? ` · ${activity.start_time}` : ""}
                    </span>
                    {!activity.is_active && <span className="a-badge is-archived">Выключена</span>}
                  </div>
                  <div className="a-activity-actions">
                    <form action={moveActivityAction}>
                      <input type="hidden" name="eventId" value={event.id} />
                      <input type="hidden" name="activityId" value={activity.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button className="a-icon-button" type="submit" disabled={index === 0} aria-label={`Выше: ${activity.title}`}>
                        ↑
                      </button>
                    </form>
                    <form action={moveActivityAction}>
                      <input type="hidden" name="eventId" value={event.id} />
                      <input type="hidden" name="activityId" value={activity.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button
                        className="a-icon-button"
                        type="submit"
                        disabled={index === activities.length - 1}
                        aria-label={`Ниже: ${activity.title}`}
                      >
                        ↓
                      </button>
                    </form>
                    <Link className="a-button a-button-secondary" href={`/admin/events/${event.id}/activities/${activity.id}`}>
                      Изменить
                    </Link>
                    <form action={toggleActivityAction}>
                      <input type="hidden" name="eventId" value={event.id} />
                      <input type="hidden" name="activityId" value={activity.id} />
                      <input type="hidden" name="active" value={activity.is_active ? "0" : "1"} />
                      <button className="a-button a-button-quiet" type="submit">
                        {activity.is_active ? "Выключить" : "Включить"}
                      </button>
                    </form>
                    <form action={deleteActivityAction}>
                      <input type="hidden" name="eventId" value={event.id} />
                      <input type="hidden" name="activityId" value={activity.id} />
                      <ConfirmSubmit
                        className="a-button a-button-quiet a-text-danger"
                        message={`Удалить услугу «${activity.title}»? Фотографии услуги будут удалены. В уже сделанных регистрациях услуга сохранится.`}
                      >
                        Удалить
                      </ConfirmSubmit>
                    </form>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="a-section" id="registrations" aria-labelledby="registrations-title">
        <div className="a-section-head">
          <h2 id="registrations-title">Регистрации · {totalRegistrations}</h2>
          <div className="a-export">
            {totalRegistrations > 0 ? (
              <a className="a-button a-button-secondary" href={`/meropriyatiya/admin/events/${event.id}/export`} download>
                Скачать Excel
              </a>
            ) : (
              <button className="a-button a-button-secondary" type="button" disabled aria-describedby="export-hint">
                Скачать Excel
              </button>
            )}
            <p className="a-hint" id="export-hint">
              {totalRegistrations > 0 ? "Все участники мероприятия, без учёта поиска." : "Регистраций пока нет — выгружать нечего."}
            </p>
          </div>
        </div>
        <form className="a-search" method="get" action={`/meropriyatiya/admin/events/${event.id}#registrations`} role="search">
          <label className="a-label" htmlFor="q">
            Поиск по ФИО или телефону
          </label>
          <div className="a-search-row">
            <input id="q" name="q" type="search" defaultValue={query} placeholder="Например, Иванов или 900" />
            <button className="a-button a-button-secondary" type="submit">
              Найти
            </button>
            {query && (
              <Link className="a-button a-button-quiet" href={`/admin/events/${event.id}#registrations`}>
                Сбросить
              </Link>
            )}
          </div>
        </form>
        {registrations.length === 0 ? (
          <p className="a-empty">{query ? "Ничего не найдено." : "Регистраций пока нет."}</p>
        ) : (
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th scope="col">Дата</th>
                  <th scope="col">ФИО</th>
                  <th scope="col">Телефон</th>
                  <th scope="col">Мессенджер</th>
                  <th scope="col">Услуги</th>
                  <th scope="col" className="is-number">
                    Сумма
                  </th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((registration) => (
                  <tr key={registration.public_id} data-testid="admin-registration">
                    <td data-label="Дата">{formatDateTime(registration.created_at)}</td>
                    <td data-label="ФИО">
                      <Link className="a-link" href={`/admin/events/${event.id}/registrations/${registration.public_id}`}>
                        {registration.full_name}
                      </Link>
                    </td>
                    <td data-label="Телефон">
                      <a className="a-link" href={`tel:${registration.phone.replace(/[^\d+]/g, "")}`}>
                        {registration.phone}
                      </a>
                    </td>
                    <td data-label="Мессенджер">{registration.messenger ?? "—"}</td>
                    <td data-label="Услуги">
                      {registration.activities.length ? registration.activities.map((item) => item.activity_title_snapshot).join(", ") : "—"}
                    </td>
                    <td data-label="Сумма" className="is-number">
                      {formatRub(registration.fixed_total_kopecks)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="a-section a-danger-zone" id="cleanup" aria-labelledby="cleanup-title">
        <h2 id="cleanup-title">Удаление данных</h2>
        <p className="a-hint">
          Чтобы просто закрыть регистрацию и скрыть страницу, используйте «Архивировать» — данные сохранятся. Действия ниже удаляют данные без
          возможности восстановления.
        </p>
        {registrationsDeleted && (
          <p className="a-message is-ok" role="status">
            Удалено регистраций: {Number(registrationsDeleted) || 0}. Мероприятие и услуги сохранены.
          </p>
        )}
        <div className="a-danger-grid">
          <DeleteRegistrationsForm key={`r-${totalRegistrations}`} count={totalRegistrations} action={deleteRegistrationsAction.bind(null, event.id)} />
          <DeleteEventForm title={event.title} registrationsCount={totalRegistrations} action={deleteEventAction.bind(null, event.id)} />
        </div>
      </section>
    </div>
  );
}
