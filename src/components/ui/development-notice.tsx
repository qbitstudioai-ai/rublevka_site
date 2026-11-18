export function DevelopmentNotice() {
  return (
    <section className="development-notice" aria-labelledby="development-title">
      <span className="development-notice__mark" aria-hidden="true">
        Р
      </span>
      <div>
        <p className="development-notice__name">Загородный комплекс «Рублевка»</p>
        <h1 id="development-title">Сайт в разработке</h1>
        <p className="development-notice__message">
          Мы готовим новое пространство о тихом отдыхе за городом.
        </p>
      </div>
    </section>
  );
}
