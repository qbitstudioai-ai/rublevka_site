import Link from "next/link";
import { SiteShell } from "@/components/site-admin/shell";
import { sectionIds, sections } from "@/content/sections";
import { requireSiteUser } from "@/server/cms/auth";
import { listDocuments } from "@/server/cms/store";
import { Status } from "@/components/site-admin/fields";

export default async function SeoPages() {
  await requireSiteUser();
  const records = await listDocuments();
  const keys = ["book", ...sectionIds] as const;
  return <SiteShell active="seo">
    <div className="sa-heading">
      <h1>SEO</h1>
      <p>Управляйте поисковыми заголовками, описаниями и индексированием страниц.</p>
    </div>
    <section className="sa-panel">
      <h2>Страницы сайта</h2>
      <ul className="sa-list">
        {keys.map((key) => {
          const record = records.find((entry) => entry.key === key);
          return <li key={key}>
            <Link href={`/admin/site/seo/${key}`}>
              <span><strong>{key === "book" ? "Главная книга" : sections[key]}</strong><small> {key === "book" ? "/" : `/${key}`}</small></span>
              {record && <Status state={record.state} />}
            </Link>
          </li>;
        })}
      </ul>
    </section>
  </SiteShell>;
}
