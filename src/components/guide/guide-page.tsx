import Link from "next/link";
import {
  reception,
  mapHref,
  type GuideItem,
  type GuidePage as Page,
} from "@/content/guest-guide";
import { sections, sectionIds, type SectionId } from "@/content/sections";
import { MediaFrame } from "../ui/media-frame";
import { BookReturn } from "./book-return";
import { PhotoGallery } from "./gallery";

function SectionLinks({ current }: { current?: SectionId }) {
  return sectionIds.map((id) => (
    <Link
      key={id}
      href={"/" + id}
      aria-current={id === current ? "page" : undefined}
    >
      {sections[id]}
    </Link>
  ));
}
export function GuideHeader({ id }: { id?: SectionId }) {
  return (
    <header className="guide-bar">
      <div className="guide-bar-inner">
        <Link className="guide-brand" href="/" aria-label="Рублевка — главная">
          Рублевка
        </Link>
        <nav className="wide-nav" aria-label="Разделы комплекса">
          <SectionLinks current={id} />
        </nav>
        <Link href="/bronirovanie" className="guide-date">
          Выбрать даты
        </Link>
        <details className="small-nav">
          <summary>Разделы ☰</summary>
          <nav aria-label="Разделы комплекса">
            <Link href="/bronirovanie">Выбрать даты проживания</Link>
            <SectionLinks current={id} />
          </nav>
        </details>
      </div>
    </header>
  );
}
function GuestAction({ action }: { action: Page["action"] }) {
  const choices = {
    stay: ["/bronirovanie", "Выбрать даты"],
    enquire: [reception.tel, "Позвонить администратору"],
    map: [mapHref, "Открыть в Яндекс Картах"],
    photos: ["#guide-details", "Смотреть фотографии"],
  } as const;
  const [href, label] = choices[action];
  return (
    <a className="guide-action" href={href}>
      {label} <span aria-hidden="true">↗</span>
    </a>
  );
}
function PageHeading({ page }: { page: Page }) {
  return (
    <div className="guide-hero">
      <div className="guide-heading">
        <BookReturn />
        <span className="guide-birds" aria-hidden="true" />
        <h1>{page.heading}</h1>
        <p>{page.intro}</p>
        <GuestAction action={page.action} />
      </div>
      <div className="guide-plate">
        <MediaFrame
          mediaId={page.photo}
          sizes="(max-width: 700px) 92vw, 54vw"
          eager
        />
        <p>{page.caption}</p>
      </div>
    </div>
  );
}
function ObjectCard({ item }: { item: GuideItem }) {
  return (
    <article className="guide-object">
      {item.photo && <MediaFrame mediaId={item.photo} sizes="(max-width: 620px) 92vw, 280px" />}
      <h3>{item.name}</h3>
      {item.detail && (
        <dl className="guide-facts">
          <dt className="visually-hidden">Характеристика объекта</dt>
          <dd>{item.detail}</dd>
        </dl>
      )}
      <p>{item.description}</p>
      {item.room && (
        <Link
          className="guide-action"
          href={`/bronirovanie?room=${item.room}`}
          aria-label={`Выбрать даты: ${item.name}`}
        >
          Выбрать даты →
        </Link>
      )}
    </article>
  );
}
function ContactDetails() {
  return (
    <dl className="contacts-list">
      <dt>Телефон</dt>
      <dd>
        <a href={reception.tel}>{reception.phone}</a>
      </dd>
      <dt>Электронная почта</dt>
      <dd>
        <a href={`mailto:${reception.email}`}>{reception.email}</a>
      </dd>
      <dt>Проживание</dt>
      <dd>
        <Link href="/bronirovanie">Выбрать даты поездки</Link>
      </dd>
      <dt>Для навигатора</dt>
      <dd>
        <a href={mapHref}>
          {reception.latitude}, {reception.longitude}
        </a>
      </dd>
    </dl>
  );
}
function GuideFooter() {
  return (
    <footer className="guide-footer">
      <div>
        <BookReturn />
        <address>{reception.address}</address>
      </div>
      <div>
        <a href={reception.tel}>{reception.phone}</a>
        <a href={`mailto:${reception.email}`}>{reception.email}</a>
      </div>
    </footer>
  );
}
export function GuestGuide({ id, page }: { id: SectionId; page: Page }) {
  return (
    <div className="guest-guide">
      <a className="guide-skip" href="#guest-content">
        К содержанию
      </a>
      <GuideHeader id={id} />
      <main className="guide-body" id="guest-content">
        <PageHeading page={page} />
        <section
          className="guide-details"
          id="guide-details"
          aria-labelledby="detail-title"
        >
          <h2 id="detail-title">{page.section}</h2>
          {page.gallery ? (
            <PhotoGallery photos={page.gallery} />
          ) : id === "kontakty" ? (
            <ContactDetails />
          ) : (
            <div className="guide-objects">
              {page.items.map((i) => (
                <ObjectCard key={i.name} item={i} />
              ))}
            </div>
          )}
        </section>
      </main>
      <GuideFooter />
    </div>
  );
}
