import Link from "next/link";
import { formatRub } from "@/lib/money";
import type { EventCardView } from "@/lib/types";
import { EventPhoto } from "./EventPhoto";

type Props = {
  event: EventCardView;
};

/**
 * Мероприятие в списке на главной. Нажатие в любом месте карточки ведёт на анкету:
 * ссылка «Зарегистрироваться» растянута на всю карточку через ::after.
 */
export function EventCard({ event }: Props) {
  const poster = !!event.heroImage && event.heroFit === "contain";
  return (
    <article className={`event-card${event.heroImage ? "" : " no-photo"}${poster ? " has-poster" : ""}`} data-testid="event-card">
      {/* Фото дублирует название рядом, поэтому для экранного диктора оно декоративное. */}
      {event.heroImage &&
        (poster ? (
          // Афиша целиком на персиковой подложке; прочитать её можно на странице мероприятия.
          <figure className="event-card-poster">
            <span className="poster-sheet">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="poster-image" src={event.heroImage.src} alt="" loading="lazy" />
            </span>
          </figure>
        ) : (
          <figure className="event-card-photo">
            <EventPhoto image={event.heroImage} decorative lazy />
          </figure>
        ))}
      <div className="event-card-body">
        <div className="event-card-head">
          <time className="event-leaf" dateTime={event.isoDate}>
            <span className="event-leaf-day">{event.day}</span>
            <span className="event-leaf-month">{event.month}</span>
          </time>
          <div className="event-card-heading">
            <p className="event-card-when">
              {event.soonLabel && <span className="event-soon">{event.soonLabel}</span>}
              {/* Запятая остаётся у дня недели при переносе, а не висит в начале строки. */}
              <span className="event-weekday">{event.weekday},</span>
              <span>{event.timeLabel}</span>
            </p>
            <h2>{event.title}</h2>
          </div>
        </div>
        {event.description && <p className="event-card-lead">{event.description}</p>}
        {event.locationLabel && <p className="event-card-place">{event.locationLabel}</p>}
        {event.priceKopecks ? <p className="event-card-price">Участие — {formatRub(event.priceKopecks)}</p> : null}
        <Link className="button-primary event-card-cta" href={`/event/${event.slug}`} aria-label={`Зарегистрироваться: ${event.title}`}>
          Зарегистрироваться
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
