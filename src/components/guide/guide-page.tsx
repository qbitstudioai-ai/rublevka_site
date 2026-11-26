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
import { type SectionId } from "@/content/sections";
import { mediaCatalog } from "@/content/media";
import {
  bookingHref,
  publicNavigation,
  type PublicNavigationId,
} from "@/content/public-nav";
import { MediaFrame } from "../ui/media-frame";
import { BookReturn } from "./book-return";
import { PhotoGallery } from "./gallery";
import { GroveFooter } from "../../../events-original/components/GroveFooter";

type GuideLocation = PublicNavigationId;

function SectionLinks({ current }: { current?: GuideLocation }) {
  return (
    <>
      {publicNavigation.map((item) =>
        item.id === "meropriyatiya" ? (
          <a key={item.id} href={item.href}>{item.label}</a>
        ) : (
          <Link
            key={item.id}
            href={item.href}
            aria-current={item.id === current ? "page" : undefined}
            prefetch={item.id === "karta" ? false : undefined}
          >
            {item.label}
          </Link>
        ),
      )}
    </>
  );
}
export function GuideHeader({ id }: { id?: GuideLocation }) {
  return (
    <header className="guide-bar">
      <div className="guide-bar-inner">
        <Link className="guide-brand" href="/" aria-label="Рублевка — главная">
          Рублевка
        </Link>
        <nav className="wide-nav" aria-label="Разделы комплекса">
          <SectionLinks current={id} />
        </nav>
        <Link href={bookingHref} className="guide-date">
          Выбрать даты
        </Link>
        <details className="small-nav">
          <summary>
            <span>Меню</span>
            <span className="guide-menu-icon" aria-hidden="true" />
          </summary>
          <nav aria-label="Разделы комплекса">
            <Link className="small-nav-date" href={bookingHref}>Выбрать даты проживания</Link>
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
  lodging,
}: {
  page: Page;
  contact: Contact;
  catalog: MediaCatalog;
  lodging: boolean;
}) {
  const photo = catalogAsset(catalog, page.photo);
  const defaultHouse = mediaCatalog["house-oaks"];
  const defaultLodgingCrop =
    lodging && photo.src === defaultHouse.src && photo.focalPoint === defaultHouse.focalPoint;

  return (
    <div className="guide-hero">
      <div className="guide-heading">
        {!lodging && <BookReturn />}
        <h1>{page.heading}</h1>
        <p>
          {page.action === "map" && page.intro === siteDefaults.kontakty.intro
            ? contact.address + "."
            : page.intro}
        </p>
        {!lodging && <GuestAction action={page.action} contact={contact} />}
      </div>
      <div className="guide-plate">
        <MediaFrame
          asset={photo}
          className={defaultLodgingCrop ? "lodging-default-crop" : undefined}
          sizes={
            lodging
              ? "(max-width: 760px) 100vw, 73vw"
              : "(max-width: 760px) 94vw, 100vw"
          }
          eager
        />
        <p className={lodging ? "visually-hidden" : undefined}>{page.caption}</p>
      </div>
    </div>
  );
}
function ObjectCard({
  item,
  catalog,
  lodging,
}: {
  item: GuideItem;
  catalog: MediaCatalog;
  lodging: boolean;
}) {
  return (
    <article className="guide-object" data-photo={Boolean(item.photo)}>
      {item.photo && (
        <MediaFrame
          asset={catalogAsset(catalog, item.photo)}
          sizes={
            lodging
              ? "(max-width: 760px) 92vw, (width < 1000px) 48vw, 28vw"
              : "(max-width: 760px) 92vw, (max-width: 1000px) 45vw, 27vw"
          }
        />
      )}
      <div className="guide-object-copy">
        <h3>{item.name}</h3>
        {!lodging && item.detail && (
          <dl className="guide-facts">
            <dt className="visually-hidden">Характеристика объекта</dt>
            <dd>{item.detail}</dd>
          </dl>
        )}
        {!lodging && <p>{item.description}</p>}
        {item.room && (
          <Link
            className="guide-action"
            href={`/bronirovanie?room=${item.room}`}
            aria-label={`Выбрать даты: ${item.name}`}
          >
            Выбрать даты{!lodging && " →"}
          </Link>
        )}
      </div>
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
export function GuideFooter({ contact }: { contact?: Contact }) {
  return <GroveFooter contact={contact} bookReturn={<BookReturn />} staff />;
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
  const lodging = id === "prozhivanie";
  const items = page.items.filter((item) => item.visible);

  return (
    <div className={`guest-guide guide-${id}`} data-section={id}>
      <a className="guide-skip" href="#guest-content">
        К содержанию
      </a>
      <GuideHeader id={id} />
      <main className="guide-body" id="guest-content">
        <PageHeading page={page} contact={contact} catalog={catalog} lodging={lodging} />
        {!lodging && page.body && <p className="guide-editorial">{page.body}</p>}
        <section
          className="guide-details"
          id="guide-details"
          aria-labelledby="detail-title"
        >
          <h2 id="detail-title" className={lodging ? "visually-hidden" : undefined}>{page.section}</h2>
          {page.gallery ? (
            <PhotoGallery
              photos={page.gallery.map((id) => catalogAsset(catalog, id))}
            />
          ) : id === "kontakty" ? (
            <ContactDetails contact={contact} />
          ) : (
            <div className="guide-objects">
              {items.map((item) => (
                <ObjectCard key={item.id} item={item} catalog={catalog} lodging={lodging} />
              ))}
            </div>
          )}
        </section>
        {lodging && items.length > 0 && (
          <details className="lodging-facts">
            <summary>Подробнее о вариантах размещения</summary>
            <dl>
              {items.map((item) => (
                <div key={item.id}>
                  <dt>{item.name}</dt>
                  <dd>{item.detail && <strong>{item.detail}. </strong>}{item.description}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}
        {lodging && page.body && <p className="guide-editorial">{page.body}</p>}
      </main>
      <GuideFooter contact={contact} />
    </div>
  );
}
