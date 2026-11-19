import Link from "next/link";
import { siteDefaults } from "@/server/cms/defaults";
import type { SiteData } from "@/server/cms/model";
import {
  catalogAsset,
  type MediaCatalog,
  type contactLinks,
} from "@/server/cms/public";
type Page = SiteData[SectionId];
type GuideItem = Page["items"][number];
type Contact = ReturnType<typeof contactLinks>;
import { sections, sectionIds, type SectionId } from "@/content/sections";
import { MediaFrame } from "../ui/media-frame";
import { BookReturn } from "./book-return";
import { PhotoGallery } from "./gallery";

function SectionLinks({ current }: { current?: SectionId }) {
  return (
    <>
      {sectionIds.map((id) => (
        <Link
          key={id}
          href={"/" + id}
          aria-current={id === current ? "page" : undefined}
        >
          {sections[id]}
        </Link>
      ))}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- The mounted events app owns its own router. */}
      <a href="/meropriyatiya">Мероприятия</a>
    </>
  );
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
function GuestAction({
  action,
  contact,
}: {
  action: Page["action"];
  contact: Contact;
}) {
  const choices = {
    stay: ["/bronirovanie", "Выбрать даты"],
    enquire: [contact.tel, "Позвонить администратору"],
    map: [contact.mapHref, "Открыть в Яндекс Картах"],
    photos: ["#guide-details", "Смотреть фотографии"],
  } as const;
  const [href, label] = choices[action];
  return (
    <a className="guide-action" href={href}>
      {label} <span aria-hidden="true">↗</span>
    </a>
  );
}
function PageHeading({
  page,
  contact,
  catalog,
}: {
  page: Page;
  contact: Contact;
  catalog: MediaCatalog;
}) {
  return (
    <div className="guide-hero">
      <div className="guide-heading">
        <BookReturn />
        <span className="guide-birds" aria-hidden="true" />
        <h1>{page.heading}</h1>
        <p>
          {page.action === "map" && page.intro === siteDefaults.kontakty.intro
            ? contact.address + "."
            : page.intro}
        </p>
        <GuestAction action={page.action} contact={contact} />
      </div>
      <div className="guide-plate">
        <MediaFrame
          asset={catalogAsset(catalog, page.photo)}
          sizes="(max-width: 700px) 92vw, 54vw"
          eager
        />
        <p>{page.caption}</p>
      </div>
    </div>
  );
}
function ObjectCard({
  item,
  catalog,
}: {
  item: GuideItem;
  catalog: MediaCatalog;
}) {
  return (
    <article className="guide-object">
      {item.photo && (
        <MediaFrame
          asset={catalogAsset(catalog, item.photo)}
          sizes="(max-width: 620px) 92vw, 280px"
        />
      )}
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
function ContactDetails({ contact }: { contact: Contact }) {
  return (
    <dl className="contacts-list">
      <dt>Телефон</dt>
      <dd>
        <a href={contact.tel}>{contact.phone}</a>
      </dd>
      <dt>Электронная почта</dt>
      <dd>
        <a href={`mailto:${contact.email}`}>{contact.email}</a>
      </dd>
      <dt>Проживание</dt>
      <dd>
        <Link href="/bronirovanie">Выбрать даты поездки</Link>
      </dd>
      {contact.socials.length > 0 && (
        <>
          <dt>Социальные сети</dt>
          <dd>
            {contact.socials.map((link) => (
              <div key={link.url}>
                <a href={link.url}>{link.name}</a>
              </div>
            ))}
          </dd>
        </>
      )}
      <dt>Для навигатора</dt>
      <dd>
        <a href={contact.mapHref}>
          {contact.latitude}, {contact.longitude}
        </a>
      </dd>
    </dl>
  );
}
export function GuideFooter({ contact }: { contact: Contact }) {
  return (
    <footer className="guide-footer">
      <div>
        <BookReturn />
        <address>{contact.address}</address>
      </div>
      <div className="guide-footer-contacts">
        <a href={contact.tel}>{contact.phone}</a>
        <a href={`mailto:${contact.email}`}>{contact.email}</a>
      </div>
      <Link className="guide-staff-link" href="/admin/site/login">
        Вход для сотрудников
      </Link>
    </footer>
  );
}
export function GuestGuide({
  id,
  page,
  contact,
  catalog,
}: {
  id: SectionId;
  page: Page;
  contact: Contact;
  catalog: MediaCatalog;
}) {
  return (
    <div className="guest-guide">
      <a className="guide-skip" href="#guest-content">
        К содержанию
      </a>
      <GuideHeader id={id} />
      <main className="guide-body" id="guest-content">
        <PageHeading page={page} contact={contact} catalog={catalog} />
        {page.body && <p className="guide-editorial">{page.body}</p>}
        <section
          className="guide-details"
          id="guide-details"
          aria-labelledby="detail-title"
        >
          <h2 id="detail-title">{page.section}</h2>
          {page.gallery ? (
            <PhotoGallery
              photos={page.gallery.map((id) => catalogAsset(catalog, id))}
            />
          ) : id === "kontakty" ? (
            <ContactDetails contact={contact} />
          ) : (
            <div className="guide-objects">
              {page.items
                .filter((item) => item.visible)
                .map((i) => (
                  <ObjectCard key={i.id} item={i} catalog={catalog} />
                ))}
            </div>
          )}
        </section>
      </main>
      <GuideFooter contact={contact} />
    </div>
  );
}
