import type { Metadata } from "next";
import Link from "next/link";
import { MediaFrame } from "@/components/ui/media-frame";
import { BookReturn } from "@/components/guide/book-return";
import {
  displayPrice,
  eventDate,
  mediaId,
} from "@/components/events/presentation";
import {
  listPublishedEvents,
  pastEvent,
  type ListedEvent,
} from "@/server/events/public";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Книга празднеств — афиша мероприятий",
  description:
    "Афиша загородного комплекса «Рублевка» в Волгоградской области. Ближайшие встречи, программы и условия участия.",
  alternates: { canonical: "/meropriyatiya" },
};
function Invitation({ event }: { event: ListedEvent }) {
  const photo = mediaId(event.imageId);
  return (
    <article className="fest-invitation">
      {photo && (
        <MediaFrame mediaId={photo} sizes="(max-width: 680px) 94vw, 34vw" />
      )}
      <div>
        <p className="fest-kicker">
          <time dateTime={event.startsAt.toISOString()}>
            {eventDate(event.startsAt, event.endsAt)}
          </time>
        </p>
        <h3>
          <Link href={"/meropriyatiya/" + event.slug}>{event.title}</Link>
        </h3>
        <p>{event.description}</p>
        <footer>
          <strong>{displayPrice(event.price)}</strong>
          <Link href={"/meropriyatiya/" + event.slug}>
            Программа и участие →
          </Link>
        </footer>
      </div>
    </article>
  );
}
export default async function EventIndex() {
  const events = await listPublishedEvents(),
    now = new Date(),
    upcoming = events.filter((e) => !pastEvent(e, now)),
    archive = events.filter((e) => pastEvent(e, now)).reverse();
  return (
    <>
      <header className="fest-index-title">
        <BookReturn />
        <span className="guide-birds" aria-hidden="true" />
        <h1>Книга празднеств</h1>
        <p>Афиша загородного комплекса «Рублевка»</p>
      </header>
      <section className="fest-list" aria-labelledby="upcoming">
        <h2 id="upcoming">Ближайшие мероприятия</h2>
        {upcoming.length ? (
          <div className="fest-grid">
            {upcoming.map((event) => (
              <Invitation event={event} key={event.id} />
            ))}
          </div>
        ) : (
          <div className="fest-empty">
            <MediaFrame
              mediaId="oak-forest"
              sizes="(max-width: 680px) 94vw, 46vw"
            />
            <div>
              <h3>Ждём новых встреч</h3>
              <p>Даты ближайших мероприятий пока не объявлены.</p>
              <Link href="/kontakty">Связаться с комплексом →</Link>
            </div>
          </div>
        )}
      </section>
      {archive.length > 0 && (
        <section className="fest-list" aria-labelledby="archive">
          <h2 id="archive">Прошедшие мероприятия</h2>
          <div className="fest-grid">
            {archive.map((event) => (
              <Invitation event={event} key={event.id} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
