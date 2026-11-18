import Link from "next/link";
import { logoutAction } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/server/admin-auth";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  // Первая линия защиты; каждая страница и каждое действие дополнительно проверяют сессию.
  await requireAdmin();

  return (
    <>
      <header className="a-topbar">
        <div className="a-topbar-inner">
          <Link className="a-brand" href="/admin">
            Рублёвка <span>админпанель</span>
          </Link>
          <nav className="a-nav" aria-label="Разделы админпанели">
            <Link href="/admin">Мероприятия</Link>
            <Link href="/admin/settings">Настройки</Link>
            <form action={logoutAction}>
              <button className="a-nav-button" type="submit">
                Выйти
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="a-main">{children}</main>
    </>
  );
}
