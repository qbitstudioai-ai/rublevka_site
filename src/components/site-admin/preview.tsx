import type { CmsMedia, SiteData, SiteKey } from "@/server/cms/model";
import { sections, type SectionId } from "@/content/sections";
import { Photo } from "./fields";

export function ContentPreview({
  document, data, media, seoOnly,
}: {
  document: SiteKey;
  data: SiteData[SiteKey];
  media: CmsMedia[];
  seoOnly: boolean;
}) {
  const photo = (id?: string) => {
    const asset = media.find((item) => item.id === id);
    return asset && <Photo asset={asset} small />;
  };
  if (document === "media") return null;
  if (document === "contacts") {
    const value = data as SiteData["contacts"];
    return (
      <section className="sa-panel sa-preview">
        <h2>Контакты на сайте</h2>
        <p>{value.phone}</p>
        <p>{value.email}</p>
        <p>{value.address}</p>
        <p>{value.latitude}, {value.longitude}</p>
        {value.socials.map((link, index) => <p key={index}>{link.name} <small>{link.url}</small></p>)}
      </section>
    );
  }
  if (seoOnly) {
    const value = data as SiteData["book"] | SiteData[SectionId];
    return (
      <section className="sa-panel sa-preview">
        <h2>Предпросмотр сниппета</h2>
        <small>{document === "book" ? "/" : `/${document}`}</small>
        <h3>{value.title}</h3>
        <p>{value.description}</p>
      </section>
    );
  }
  if (document === "book") {
    const { chapters } = data as SiteData["book"];
    return (
      <section className="sa-panel sa-preview">
        <h2>Предпросмотр глав</h2>
        {chapters.map((chapter) => (
          <article key={chapter.id} className="sa-panel">
            <h3>{chapter.title}</h3>
            {chapter.text && <p>{chapter.text}</p>}
            {photo(chapter.photo)}
            {chapter.caption && <p>{chapter.caption}</p>}
            {chapter.entries?.map((entry, index) => (
              <p key={index}>{entry.title} → {sections[entry.section]}</p>
            ))}
          </article>
        ))}
      </section>
    );
  }
  const value = data as SiteData[SectionId];
  return (
    <section className="sa-panel sa-preview">
      <h2>Предпросмотр страницы</h2>
      <article className="sa-stack">
        <h3>{value.heading}</h3>
        <p>{value.intro}</p>
        {value.body && <p>{value.body}</p>}
        {photo(value.photo)}
        <p>{value.caption}</p>
        {value.items.filter((item) => item.visible).map((item) => (
          <article className="sa-panel" key={item.id}>
            <h3>{item.name}</h3>
            {item.detail && <p>{item.detail}</p>}
            <p>{item.description}</p>
            {photo(item.photo)}
          </article>
        ))}
        {value.gallery?.map((id) => <div key={id}>{photo(id)}</div>)}
      </article>
    </section>
  );
}
