import Link from "next/link";

export default function NotFound() {
  return (
    <main className="status-page">
      <div className="status-card">
        <p className="eyebrow">Загородный комплекс «Рублёвка»</p>
        <h1>Страница недоступна</h1>
        <p>Возможно, регистрация на мероприятие закрыта или ссылка содержит ошибку. Уточните ссылку у организаторов.</p>
        <Link className="button-secondary" href="/">
          Все мероприятия
        </Link>
      </div>
    </main>
  );
}
