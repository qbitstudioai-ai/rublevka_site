import type { SiteData } from "@/server/cms/model";
import type { ManifestoChapter } from "@/content/home";
import { Fragment } from "react";
import { sectionIds, sections, type SectionId } from "@/content/sections";
import { Field, MoveButtons, moveAt, Photo, PhotosField } from "./fields";

type SpareMedia = {
  items: SiteData["media"]["items"];
  publishedMedia: string[];
};
type Change<T> = { value: T; change: (value: T) => void };
type MetadataFields = { title: string; description: string; indexable: boolean };
type Guide = SiteData[SectionId];
type Book = SiteData["book"];
type Contacts = SiteData["contacts"];

export function SeoFields({
  value, change, canonical,
}: Change<MetadataFields> & { canonical: string }) {
  return (
    <section className="sa-panel">
      <h2>Поисковая выдача</h2>
      <Field label="SEO title" value={value.title} onChange={(title) => change({ ...value, title })} />
      <Field label="SEO description" multiline value={value.description}
        onChange={(description) => change({ ...value, description })} />
      <label className="sa-check">
        <input type="checkbox" checked={value.indexable}
          onChange={(event) => change({ ...value, indexable: event.target.checked })} />
        Разрешить индексацию на публичном сайте
      </label>
      <p className="sa-hint">Canonical <code>{canonical}</code></p>
    </section>
  );
}

export function GuideFields({
  value, change, items, publishedMedia, selectedItem,
}: Change<Guide> & SpareMedia & { selectedItem?: string }) {
  return (
    <>
      <section className="sa-panel">
        <h2>Страница</h2>
        <Field label="Заголовок страницы" value={value.heading}
          onChange={(heading) => change({ ...value, heading })} />
        <Field label="Краткое описание" multiline value={value.intro}
          onChange={(intro) => change({ ...value, intro })} />
        <Field label="Основной текст" multiline value={value.body}
          onChange={(body) => change({ ...value, body })} />
        <PhotosField label="Главная фотография" items={items} publishedMedia={publishedMedia}
          value={value.photo} onChange={(photo) => change({ ...value, photo })} />
        <Field label="Подпись к главной фотографии" value={value.caption}
          onChange={(caption) => change({ ...value, caption })} />
        <Field label="Заголовок раздела" value={value.section}
          onChange={(section) => change({ ...value, section })} />
      </section>
      {value.items.length > 0 && (
        <section className="sa-panel" id="site-objects">
          <h2>Карточки объектов</h2>
          {value.items.map((item, index) => {
            const update = (patch: Partial<Guide["items"][number]>) => change({
              ...value,
              items: value.items.map((entry) => entry.id === item.id ? { ...entry, ...patch } : entry),
            });
            return (
              <details className="sa-item" key={item.id} open={selectedItem === item.id ? true : undefined}>
                <summary>{item.name} {!item.visible && <span className="sa-hint">· Снято с публикации</span>}</summary>
                <div className="sa-stack">
                  <Field label="Название объекта" value={item.name} onChange={(name) => update({ name })} />
                  <Field label="Характеристики" value={item.detail}
                    onChange={(detail) => update({ detail })} />
                  <Field label="Описание объекта" multiline value={item.description}
                    onChange={(description) => update({ description })} />
                  <PhotosField label="Фотография объекта" items={items} publishedMedia={publishedMedia}
                    value={item.photo} onChange={(photo) => update({ photo: photo || undefined })} optional />
                  <div className="sa-item-head">
                    <label className="sa-check">
                      <input type="checkbox" checked={item.visible}
                        onChange={(event) => update({ visible: event.target.checked })} />
                      Показывать на странице
                    </label>
                    <MoveButtons name={item.name} index={index} count={value.items.length}
                      move={(step) => change({ ...value, items: moveAt(value.items, index, step) })} />
                  </div>
                </div>
              </details>
            );
          })}
        </section>
      )}
      {value.gallery && (
        <section className="sa-panel">
          <h2>Изображения галереи</h2>
          <div className="sa-gallery">
            {value.gallery.map((id, index, gallery) => {
              const asset = items.find((photo) => photo.id === id);
              return (
                <div className="sa-media-card" key={id}>
                  {asset && <Photo asset={asset} />}
                  <strong>{asset?.name ?? id}</strong>
                  <MoveButtons name={asset?.name ?? id} index={index} count={gallery.length}
                    move={(step) => change({ ...value, gallery: moveAt(gallery, index, step) })} />
                  <button type="button" className="sa-button"
                    onClick={() => change({ ...value, gallery: gallery.filter((entry) => entry !== id) })}>
                    Убрать из галереи
                  </button>
                </div>
              );
            })}
          </div>
          <label className="sa-field">
            Добавить фотографию из медиатеки
            <select value="" onChange={(event) => change({ ...value, gallery: [...value.gallery!, event.target.value] })}>
              <option value="" disabled>Выберите фото</option>
              {items.filter((photo) => !value.gallery?.includes(photo.id)).map((photo) => (
                <option key={photo.id} value={photo.id}>{photo.name}</option>
              ))}
            </select>
          </label>
        </section>
      )}
    </>
  );
}

export function BookFields({ value, change, items, publishedMedia }: Change<Book> & SpareMedia) {
  return (
    <section className="sa-panel">
      <h2>Главы книги</h2>
      {value.chapters.map((chapter, index) => {
        const update = (updated: Book["chapters"][number]) => change({
          ...value,
          chapters: value.chapters.map((entry) => entry.id === chapter.id ? updated : entry),
        });
        return (
          <details className="sa-item" key={chapter.id} open={index === 0 ? true : undefined}>
            <summary>Глава {index + 1} · {chapter.title}</summary>
            <div className="sa-stack">
              <Field label="Название главы" value={chapter.title} onChange={(title) => update({ ...chapter, title })} />
              <Field label="Подпись в оглавлении" value={chapter.label} onChange={(label) => update({ ...chapter, label })} />
              {chapter.layout === "manifesto" ? (
                <ManifestoFields value={chapter} change={update} />
              ) : (
                <>
                  <Field label="Короткое описание" multiline value={chapter.text}
                    onChange={(text) => update({ ...chapter, text })} />
                  <PhotosField label="Фотография главы" value={chapter.photo} items={items}
                    publishedMedia={publishedMedia} onChange={(photo) => update({ ...chapter, photo })} />
                  <Field label="Подпись к фотографии" value={chapter.caption}
                    onChange={(caption) => update({ ...chapter, caption })} />
                  {chapter.entries?.map((entry, index, entries) => (
                    <div className="sa-fields" key={index}>
                      <Field label={`Текст ссылки ${index + 1}`} value={entry.title}
                        onChange={(title) => update({
                          ...chapter,
                          entries: entries.map((item, i) => i === index ? { ...item, title } : item),
                        })} />
                      <label className="sa-field">
                        Раздел сайта
                        <select value={entry.section} onChange={(event) => update({
                          ...chapter,
                          entries: entries.map((item, i) => i === index
                            ? { ...item, section: event.target.value as SectionId }
                            : item),
                        })}>
                          {sectionIds.map((id) => <option key={id} value={id}>{sections[id]}</option>)}
                        </select>
                      </label>
                    </div>
                  ))}
                </>
              )}
            </div>
          </details>
        );
      })}
    </section>
  );
}

function ManifestoFields({ value, change }: Change<ManifestoChapter>) {
  return (
    <>
      <Field label="Подзаголовок" multiline value={value.subtitle}
        onChange={(subtitle) => change({ ...value, subtitle })} />
      {value.paragraphs.map((paragraph, index) => (
        <Fragment key={index}>
          <Field label={`Абзац ${index + 1}`} multiline value={paragraph}
            onChange={(next) => change({
              ...value,
              paragraphs: value.paragraphs.map((item, i) => i === index ? next : item),
            })} />
          {index === 2 && (
            <Field label="Ключевая фраза" value={value.emphasis}
              onChange={(emphasis) => change({ ...value, emphasis })} />
          )}
        </Fragment>
      ))}
      <Field label="Заключительная фраза" value={value.closing}
        onChange={(closing) => change({ ...value, closing })} />
      <Field label="Цитата под гравюрой" multiline value={value.quote}
        onChange={(quote) => change({ ...value, quote })} />
    </>
  );
}

export function ContactFields({ value, change }: Change<Contacts>) {
  return (
    <>
      <section className="sa-panel">
        <h2>Как связаться</h2>
        <div className="sa-fields">
          <Field label="Телефон" value={value.phone} type="tel"
            onChange={(phone) => change({ ...value, phone })} />
          <Field label="Электронная почта" value={value.email} type="email"
            onChange={(email) => change({ ...value, email })} />
        </div>
        <Field label="Адрес" value={value.address} onChange={(address) => change({ ...value, address })} />
        <Field label="Населённый пункт" value={value.location}
          onChange={(location) => change({ ...value, location })} />
        <div className="sa-fields">
          <Field label="Широта" value={Number.isFinite(value.latitude) ? value.latitude : ""} type="number"
            onChange={(latitude) => change({ ...value, latitude: latitude === "" ? NaN : Number(latitude) })} />
          <Field label="Долгота" value={Number.isFinite(value.longitude) ? value.longitude : ""} type="number"
            onChange={(longitude) => change({ ...value, longitude: longitude === "" ? NaN : Number(longitude) })} />
        </div>
      </section>
      <section className="sa-panel">
        <h2>Социальные сети</h2>
        {value.socials.map((link, index) => (
          <div className="sa-item sa-stack" key={index}>
            <Field label="Название" value={link.name} onChange={(name) => change({
              ...value, socials: value.socials.map((item, i) => i === index ? { ...item, name } : item),
            })} />
            <Field label="Официальная ссылка" value={link.url} type="url" onChange={(url) => change({
              ...value, socials: value.socials.map((item, i) => i === index ? { ...item, url } : item),
            })} />
            <div className="sa-actions">
              <button type="button" className="sa-button"
                onClick={() => change({ ...value, socials: value.socials.filter((_, i) => i !== index) })}>
                Убрать ссылку
              </button>
            </div>
          </div>
        ))}
        <div className="sa-actions">
          <button type="button" className="sa-button"
            onClick={() => change({ ...value, socials: [...value.socials, { name: "", url: "" }] })}>
            Добавить ссылку
          </button>
        </div>
      </section>
    </>
  );
}
