import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { CommunitySection } from "@/components/CommunitySection";
import { EventCard } from "@/components/EventCard";
import { PublicSiteHeader } from "@/components/PublicSiteHeader";
import { GroveFooter } from "@/components/GroveFooter";
import { BRAND_LOGO, MAIN_SITE_URL } from "@/lib/brand";
import { todayIso } from "@/lib/format";
import { getDb } from "@/lib/server/db";
import { getPublicSettings, toEventCardView } from "@/lib/server/public-data";
import { listUpcomingPublishedEvents } from "@/lib/server/repo/events";

export const metadata: Metadata = {
  title: "Мероприятия — загородный комплекс «Рублёвка»",
  description: "Ближайшие мероприятия загородного комплекса «Рублёвка»: выберите мероприятие и зарегистрируйтесь.",
  alternates: { canonical: "/meropriyatiya" },
};

/**
 * Главная — список мероприятий с открытой регистрацией.
 * Список читается из БД при каждом запросе (connection()), поэтому мероприятие,
 * опубликованное, архивированное или удалённое в админпанели, сразу появляется или исчезает.
 */
export default async function Home() {
  await connection();
  const db = getDb();
  const today = todayIso();
  const events = listUpcomingPublishedEvents(db, today).map((event) => toEventCardView(event, today));
  const { community } = getPublicSettings(db);

  return (
    <div className="public-site-shell">
      <PublicSiteHeader onIndex />
      <main>
        <header className="events-hero" aria-labelledby="events-title">
          <div className="events-hero-inner">
            <div className="events-hero-top">
              <a className="events-logo-link" href={MAIN_SITE_URL}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="events-logo" src={BRAND_LOGO.src} alt={`${BRAND_LOGO.alt} — основной сайт`} />
              </a>
              {/* Вход защищён паролем: без сессии /admin ведёт на страницу входа. */}
              <Link className="admin-link" href="/admin" prefetch={false}>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <rect x="5" y="10.5" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
                Админпанель
              </Link>
            </div>
            <h1 id="events-title">
              <span className="hero-kicker">Регистрация участников</span>
              <span className="hero-title">Ближайшие мероприятия</span>
            </h1>
            {events.length > 0 && (
              <p className="hero-lead">Выберите мероприятие — на его странице можно зарегистрироваться и добавить активности к своему дню.</p>
            )}
          </div>
        </header>

        <section className="events-section section-shell" aria-label="Мероприятия с открытой регистрацией">
          {events.length > 0 ? (
            <ul className="events-list">
              {events.map((event) => (
                <li key={event.id}>
                  <EventCard event={event} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="events-empty">
              <h2>Сейчас нет открытых регистраций</h2>
              <p>Новые мероприятия появятся на этой странице, как только организаторы их опубликуют.</p>
              <a className="button-secondary" href={MAIN_SITE_URL}>
                На сайт комплекса
              </a>
            </div>
          )}
        </section>

        <CommunitySection community={community} />
      </main>
      <GroveFooter />
    </div>
  );
}
