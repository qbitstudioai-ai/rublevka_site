import Link from "next/link";
import type { ReactNode } from "react";
import { signOutSite } from "@/app/admin/site/session-actions";
import { sectionIds, sections } from "@/content/sections";
import { requireSiteUser } from "@/server/cms/auth";

export const siteAdminNav = [
  { id: "", name: "Обзор сайта", icon: "▦" },
  ...sectionIds.filter((id) => id !== "kontakty").map((id) => ({
    id, name: sections[id], icon: "·",
  })),
  { id: "media", name: "Медиатека", icon: "▧" },
  { id: "book", name: "Главная книга", icon: "◫" },
  { id: "contacts", name: "Контакты", icon: "◎" },
  { id: "seo", name: "SEO", icon: "↗" },
] as const;

export async function SiteShell({
  active, children,
}: {
  active: string;
  children: ReactNode;
}) {
  const user = await requireSiteUser();
  const nav = user.role === "admin"
    ? [...siteAdminNav, { id: "users", name: "Сотрудники", icon: "♙" }]
    : siteAdminNav;
  return (
    <div className="site-admin">
      <a className="sa-skip" href="#site-admin-content">К содержанию</a>
      <aside className="sa-sidebar">
        <Link href="/admin/site" className="sa-brand">
          <span className="sa-mark" aria-hidden="true">Р</span>
          <span><strong>Рублевка</strong><small>Управление сайтом</small></span>
        </Link>
        <nav className="sa-nav" aria-label="Разделы управления">
          {nav.map(({ id, name, icon }) => (
            <Link
              key={id}
              href={id ? `/admin/site/${id}` : "/admin/site"}
              aria-current={active === id ? "page" : undefined}
            >
              <span aria-hidden="true">{icon}</span> {name}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="sa-main">
        <header className="sa-top">
          <Link href="/">Открыть сайт ↗</Link>
          <div className="sa-account">
            <span>{user.login} <small>{user.role === "admin" ? "Администратор" : "Редактор"}</small></span>
            <form action={signOutSite}>
              <button className="sa-button" type="submit">Выйти</button>
            </form>
          </div>
        </header>
        <main id="site-admin-content" className="sa-content">
          {children}
        </main>
      </div>
    </div>
  );
}
