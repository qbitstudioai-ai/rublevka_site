const links = [
  ["Проживание", "/prozhivanie"],
  ["Беседки", "/besedki"],
  ["Банкетные залы", "/banketnye-zaly"],
  ["Баня", "/banya"],
  ["Услуги", "/uslugi"],
  ["Мероприятия", "/meropriyatiya"],
  ["Карта комплекса", "/karta"],
  ["Галерея", "/galereya"],
  ["Контакты", "/kontakty"],
] as const;

function Navigation({ onIndex }: { onIndex: boolean }) {
  return (
    <>
      {links.map(([label, href]) => (
        <a
          key={href}
          href={href}
          aria-current={href === "/meropriyatiya" ? (onIndex ? "page" : "location") : undefined}
        >
          {label}
        </a>
      ))}
    </>
  );
}

export function PublicSiteHeader({ onIndex = false }: { onIndex?: boolean }) {
  return (
    <header className="public-site-header">
      <div className="public-site-header-inner">
        {/* A plain root URL must escape basePath=/meropriyatiya and reach the main application. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="public-site-brand" href="/" aria-label="Рублевка — главная">
          Рублевка
        </a>
        <nav className="public-site-nav" aria-label="Разделы комплекса">
          <Navigation onIndex={onIndex} />
        </nav>
        <a className="public-site-booking" href="/bronirovanie">
          Выбрать даты
        </a>
        <details className="public-site-menu">
          <summary aria-label="Открыть меню">
            <span className="public-site-menu-icon" aria-hidden="true" />
          </summary>
          <nav aria-label="Разделы комплекса">
            <a className="public-site-menu-booking" href="/bronirovanie">Выбрать даты проживания</a>
            <Navigation onIndex={onIndex} />
          </nav>
        </details>
      </div>
    </header>
  );
}
