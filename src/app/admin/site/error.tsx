"use client";

import Link from "next/link";

export default function SiteAdminError({ reset }: { reset: () => void }) {
  return (
    <div className="site-admin sa-login">
      <main className="sa-panel">
        <h1>Панель временно недоступна</h1>
        <p>Повторите попытку. Если ошибка остаётся, проверьте подключение к базе данных и начальный импорт контента.</p>
        <div className="sa-actions">
          <button type="button" className="sa-button sa-button-primary" onClick={reset}>Повторить</button>
          <Link href="/">На сайт</Link>
        </div>
      </main>
    </div>
  );
}
