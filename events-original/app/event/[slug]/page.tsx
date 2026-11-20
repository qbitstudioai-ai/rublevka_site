import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CommunitySection } from "@/components/CommunitySection";
import { RegistrationExperience } from "@/components/RegistrationExperience";
import { PublicSiteHeader } from "@/components/PublicSiteHeader";
import { BRAND_LOGO } from "@/lib/brand";
import { isPastEvent } from "@/lib/format";
import { getDb } from "@/lib/server/db";
import { getPublicActivities, getPublicSettings, toEventView } from "@/lib/server/public-data";
import { getPublishedEventBySlug } from "@/lib/server/repo/events";
import { SLUG_PATTERN } from "@/lib/slug";

type PageProps = {
  params: Promise<{ slug: string }>;
};

/** Опубликованное мероприятие или null: черновики и архив публично не показываются. */
async function loadEvent(slug: string) {
  await connection();
  if (!SLUG_PATTERN.test(slug)) return null;
  return getPublishedEventBySlug(getDb(), slug);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const event = await loadEvent((await params).slug);
  if (!event) return { title: "Страница недоступна — Рублёвка" };
  return {
    title: isPastEvent(event.event_date) ? `Регистрация закрыта — ${event.title}` : `Регистрация участников — ${event.title}`,
    description: event.short_description || "Анкета регистрации участников мероприятия загородного комплекса «Рублёвка».",
  };
}

export default async function EventPage({ params }: PageProps) {
  const event = await loadEvent((await params).slug);
  if (!event) notFound();

  const db = getDb();
  // Прошедшее мероприятие остаётся доступным по ссылке, но вместо анкеты — «Регистрация закрыта».
  const closed = isPastEvent(event.event_date);
  const activities = closed ? [] : getPublicActivities(db, event.id);
  const { community } = getPublicSettings(db);

  return (
    <div className="public-site-shell">
      <PublicSiteHeader />
      <main>
        <RegistrationExperience event={toEventView(event)} activities={activities} logo={BRAND_LOGO} closed={closed} />
        <CommunitySection community={community} />
      </main>
      <footer className="site-footer">
        <p>Загородный комплекс «Рублёвка»</p>
      </footer>
    </div>
  );
}
