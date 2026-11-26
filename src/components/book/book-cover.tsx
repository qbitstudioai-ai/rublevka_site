import type { AnimationEvent } from "react";

export type BookEntryState = "closed" | "opening" | "open";

export function BookCover({
  entry,
  open,
  opened,
}: {
  entry: BookEntryState;
  open: () => void;
  opened: () => void;
}) {
  const bookOpen = entry === "open";
  const finishOpening = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && entry === "opening") opened();
  };

  return (
    <section
      className="book-cover-scene"
      aria-label="Обложка книги загородного комплекса «Рублевка»"
      aria-hidden={bookOpen}
      data-entry={entry}
      inert={bookOpen}
      hidden={bookOpen}
    >
      <div className="closed-book">
        <div className="book-page-block" aria-hidden="true" />
        <div className="book-front-cover" onAnimationEnd={finishOpening}>
          <div className="book-cover-copy">
            <div className="book-cover-title">
              <span>Загородный комплекс </span>
              <strong>«Рублевка»</strong>
            </div>
            <span className="book-cover-rule" aria-hidden="true" />
            <p className="book-cover-motto">
              Уехать от городского шума, чтобы отдохнуть душой.
            </p>
            <button
              className="book-open-button"
              type="button"
              onClick={open}
              disabled={entry !== "closed"}
            >
              <span aria-hidden="true">◆</span>
              Окунуться в волшебство загородного отдыха
              <span aria-hidden="true">◆</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
