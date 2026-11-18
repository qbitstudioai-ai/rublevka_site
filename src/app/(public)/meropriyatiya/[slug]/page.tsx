import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MediaFrame } from "@/components/ui/media-frame";
import {
  displayPrice,
  eventDate,
  mediaId,
  stayLink,
} from "@/components/events/presentation";
import { RegistrationForm } from "@/components/events/registration-form";
import { resolveMedia } from "@/content/media";
import { reception } from "@/content/guest-guide";
import { loadPublicEvent } from "@/server/events/public";
import { testRegistrationEnabled } from "@/server/events/test-mode";
import { getSiteUrl } from "@/server/site-url";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
async function getEvent({ params }: Props) {
  const event = await loadPublicEvent((await params).slug);
  if (!event) notFound();
  return event;
}
export async function generateMetadata(props: Props): Promise<Metadata> {
  const event = await getEvent(props);
  return {
    title: event.title + " — программа мероприятия",
    description:
      event.description ||
      "Программа и условия участия в мероприятии «" +
        event.title +
        "» на Рублевке.",
    alternates: { canonical: "/meropriyatiya/" + event.slug },
  };
}
const labels = {
  open: "Регистрация открыта",
  closed: "Регистрация закрыта",
  cancelled: "Мероприятие отменено",
  completed: "Мероприятие завершено",
  full: "Свободных мест нет",
  draft: "Черновик",
} as const;
export default async function EventPage(props: Props) {
  const event = await getEvent(props),
    enabled = await testRegistrationEnabled(),
    open = event.status === "open",
    photo = mediaId(event.imageId);
  const base = getSiteUrl(),
    url = new URL("/meropriyatiya/" + event.slug, base).href;
  const schema = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description,
    startDate: event.startsAt.toISOString(),
    endDate: event.endsAt.toISOString(),
    url,
    image: photo ? new URL(resolveMedia(photo).src, base).href : undefined,
    location: {
      "@type": "Place",
      name: "Загородный комплекс «Рублевка»",
      address: reception.address,
    },
    eventStatus:
      event.status === "cancelled"
        ? "https://schema.org/EventCancelled"
        : "https://schema.org/EventScheduled",
    isAccessibleForFree: event.price === null ? undefined : event.price === 0,
  };
  return (
    <>
      <Link href="/meropriyatiya" className="back-to-book">
        ← К афише
      </Link>
      <header className="fest-hero">
        <div className="fest-description">
          <span className="guide-birds" aria-hidden="true" />
          <p className="fest-kicker">Книга празднеств</p>
          <h1>{event.title}</h1>
          <p>{event.description}</p>
          <dl className="fest-facts">
            <div>
              <dt>Когда</dt>
              <dd>
                <time dateTime={event.startsAt.toISOString()}>
                  {eventDate(event.startsAt, event.endsAt)}
                </time>
              </dd>
            </div>
            <div>
              <dt>Участие</dt>
              <dd>{displayPrice(event.price)}</dd>
            </div>
          </dl>
          {open && enabled ? (
            <a className="guide-action" href="#event-registration">
              {event.group ? "Оставить обращение" : "Зарегистрироваться"} ↓
            </a>
          ) : (
            <p className="fest-status">
              {open
                ? "Приём заявок на сайте пока закрыт"
                : labels[event.status]}
            </p>
          )}
        </div>
        {photo && (
          <div className="fest-picture">
            <a
              href={resolveMedia(photo).src}
              aria-label={
                "Открыть изображение мероприятия «" + event.title + "»"
              }
            >
              <MediaFrame
                mediaId={photo}
                sizes="(max-width: 760px) 94vw, 45vw"
                eager
              />
              <span>Увеличить изображение ↗</span>
            </a>
          </div>
        )}
      </header>
      {event.program && (
        <details className="fest-scroll">
          <summary>Программа мероприятия</summary>
          <div>{event.program}</div>
        </details>
      )}
      {event.conditions && (
        <section className="fest-conditions">
          <h2>Условия участия</h2>
          <p>{event.conditions}</p>
        </section>
      )}
      {open ? (
        <RegistrationForm
          key={event.id}
          event={{
            id: event.id,
            title: event.title,
            group: event.group,
            termsVersion: event.termsVersion,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            price: event.price,
          }}
          options={event.options}
          enabled={enabled}
          requestId={randomUUID()}
        />
      ) : (
        event.options.length > 0 && (
          <section className="fest-conditions">
            <h2>Дополнительные активности</h2>
            {event.options.map((o) => (
              <p key={o.id}>
                <strong>{o.title}</strong> · {displayPrice(o.price)}
                <br />
                {o.description}
              </p>
            ))}
          </section>
        )
      )}
      {event.startsAt > new Date() && event.status !== "cancelled" && (
        <aside className="fest-lodging">
          <div>
            <h2>Остаться на Рублевке</h2>
            <p>Проживание оформляется отдельно от участия в мероприятии.</p>
          </div>
          <Link
            className="guide-date"
            href={stayLink(event.startsAt, event.endsAt)}
          >
            Выбрать даты проживания →
          </Link>
        </aside>
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}
