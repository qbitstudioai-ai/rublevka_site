import Link from "next/link";
import { SiteShell, siteAdminNav } from "@/components/site-admin/shell";
import { Status } from "@/components/site-admin/fields";
import { requireSiteUser } from "@/server/cms/auth";
import { listDocuments } from "@/server/cms/store";

export default async function AdminHome() {
  await requireSiteUser();
  const records = await listDocuments();
  const pending = records.filter((entry) => entry.state === "review");
  const nav = siteAdminNav.filter(({ id }) => id !== "" && id !== "seo");
  return (
    <SiteShell active="">
      <div className="sa-heading">
        <h1>Обзор сайта</h1>
        <p>Редактируйте страницы, фотографии и главы книги «Рублевки».</p>
      </div>
      <div className="sa-grid sa-dashboard">
        <section className="sa-panel">
          <h2>Разделы сайта</h2>
          <ul className="sa-list">
            {nav.map(({ id, name }) => {
              const record = records.find((entry) => entry.key === id);
              return <li key={id}>
                <Link href={`/admin/site/${id}`}>
                  <span><strong>{name}</strong></span>
                  {record ? <Status state={record.state} /> : <span aria-hidden="true">→</span>}
                </Link>
              </li>;
            })}
          </ul>
        </section>
        <div className="sa-stack">
          <section className="sa-panel">
            <h2>На проверке</h2>
            {pending.length === 0 ? <p className="sa-hint">Новых черновиков на проверку пока нет.</p> :
              <ul className="sa-list">
                {pending.map(({ key }) => (
                  <li key={key}><Link href={`/admin/site/${key}`}>
                    {nav.find((item) => item.id === key)?.name ?? "Страница контактов"}
                    <span aria-hidden="true">→</span>
                  </Link></li>
                ))}
              </ul>}
          </section>
          <section className="sa-panel">
            <h2>Поисковая выдача</h2>
            <p className="sa-hint">Заголовки и описания публичных страниц.</p>
            <div><Link className="sa-button" href="/admin/site/seo">Настроить SEO →</Link></div>
          </section>
        </div>
      </div>
    </SiteShell>
  );
}
