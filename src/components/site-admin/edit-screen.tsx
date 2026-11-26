import Link from "next/link";
import { sectionIds, sections, type SectionId } from "@/content/sections";
import { requireSiteUser } from "@/server/cms/auth";
import { photoReferences, type CmsGuide, type SiteKey } from "@/server/cms/model";
import { readDocument } from "@/server/cms/store";
import { getSiteUrl } from "@/server/site-url";
import { ContentEditor } from "./editor";
import { SiteShell } from "./shell";

function getTitle(key: SiteKey) {
  if (key === "book") return "Главная книга";
  if (key === "contacts") return "Контакты";
  if (key === "media") return "Медиатека";
  if (key === "kontakty") return "Страница контактов";
  return sections[key];
}

export async function SiteEditScreen({
  documentKey, seoOnly = false, selectedItem,
}: {
  documentKey: SiteKey;
  seoOnly?: boolean;
  selectedItem?: string;
}) {
  const user = await requireSiteUser();
  const [record, media] = await Promise.all([readDocument(documentKey), readDocument("media")]);
  const path = documentKey === "book" ? "/" : documentKey === "contacts" ? "/kontakty" : `/${documentKey}`;
  const title = getTitle(documentKey);
  const guide = sectionIds.includes(documentKey as SectionId) && !seoOnly
    ? record.draft as CmsGuide
    : undefined;
  const publishedMedia = new Map(
    media.published.items.map((item) => [item.id, JSON.stringify(item)]),
  );
  const changedMedia = new Set(
    media.draft.items
      .filter((item) => publishedMedia.get(item.id) !== JSON.stringify(item))
      .map((item) => item.id),
  );
  const initialMediaLinked = documentKey !== "media" &&
    media.state !== "published" &&
    photoReferences(documentKey, record.draft).some((id) => changedMedia.has(id));
  return (
    <SiteShell active={seoOnly ? "seo" : documentKey === "kontakty" ? "contacts" : documentKey}>
      <div className="sa-heading">
        <Link className="sa-back" href={seoOnly ? "/admin/site/seo" : "/admin/site"}>
          ← {seoOnly ? "Все страницы SEO" : "Обзор сайта"}
        </Link>
        <h1>{seoOnly ? `SEO · ${title}` : title}</h1>
        <p>{documentKey === "media"
          ? "Управляйте фотографиями, которые можно назначать страницам, объектам и главам книги."
          : "Сохраните черновик, чтобы продолжить редактирование или передать изменения на публикацию."}</p>
        {documentKey === "contacts" && <Link href="/admin/site/kontakty">Редактировать текст страницы контактов →</Link>}
      </div>
      {guide && documentKey === "prozhivanie" && <section className="sa-panel sa-objects">
        <h2>Дома и номера</h2>
        <ul className="sa-list">
          {guide.items.map((item) => (
            <li key={item.id}>
              <Link href={`/admin/site/prozhivanie?item=${encodeURIComponent(item.id)}#site-objects`}>
                <span>{item.name}</span><span className="sa-hint">{item.visible ? "Редактировать →" : "Снято с публикации"}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>}
      <ContentEditor
        key={`${documentKey}-${selectedItem ?? ""}-${seoOnly}`}
        documentKey={documentKey}
        initial={{
          draft: record.draft,
          revision: record.revision,
          state: record.state,
          publishedAt: record.publishedAt?.toISOString() ?? null,
          previousAt: record.previousAt?.toISOString() ?? null,
          hasPrevious: record.hasPrevious,
        }}
        mediaInitial={{
          draft: media.draft,
          revision: media.revision,
          state: media.state,
          publishedAt: media.publishedAt?.toISOString() ?? null,
          previousAt: media.previousAt?.toISOString() ?? null,
          hasPrevious: media.hasPrevious,
        }}
        initialMediaLinked={initialMediaLinked}
        draftMedia={[...changedMedia]}
        canPublish={user.role === "admin"}
        canonical={new URL(path, getSiteUrl()).href}
        seoOnly={seoOnly}
        selectedItem={selectedItem}
      />
    </SiteShell>
  );
}
