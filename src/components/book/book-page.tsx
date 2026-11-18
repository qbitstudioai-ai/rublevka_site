import { MediaFrame } from "../ui/media-frame";
import Link from "next/link";
import type { Chapter } from "@/content/home";
import { rememberChapter } from "../guide/book-return";

export function roman(page: number) {
  const numerals = [
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
  ];
  return numerals[page - 1] ?? String(page);
}

type Props = {
  chapter: Chapter;
  index: number;
  count: number;
  active: boolean;
  departing: boolean;
  select: (n: number) => void;
};
export function BookPage({
  chapter,
  index,
  count,
  active,
  departing,
  select,
}: Props) {
  const opening = chapter.layout === "opening";
  const Title = opening ? "h1" : "h2";
  return (
    <section
      className={"spread " + chapter.layout}
      hidden={!active && !departing}
      data-active={active || undefined}
      data-departing={departing || undefined}
      inert={!active}
      aria-labelledby={chapter.id + "-title"}
    >
      <div className="leaf recto-copy">
        <div className="inscription">
          <span className="birds" aria-hidden="true" />
          {!opening && (
            <span className="numeral" aria-hidden="true">
              {roman(index + 1)}
            </span>
          )}
          <Title data-title tabIndex={-1} id={chapter.id + "-title"}>
            {chapter.title}
          </Title>
          <span className="rule" aria-hidden="true" />
          {chapter.text && <p className="motto">{chapter.text}</p>}
        </div>
        {chapter.entries && (
          <ul className="contents">
            {chapter.entries.map((entry) => (
              <li key={entry.section}>
                <Link
                  href={"/" + entry.section}
                  onClick={() => rememberChapter(chapter.id)}
                >
                  {entry.title}
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {opening && (
          <Link
            className="seal book-dates"
            href="/bronirovanie"
            onClick={() => rememberChapter(chapter.id)}
          >
            Выбрать даты
          </Link>
        )}
        {chapter.layout === "closing" && (
          <button className="seal" onClick={() => select(0)}>
            К началу <span aria-hidden="true">↶</span>
          </button>
        )}
        <nav className="folio-nav" aria-label="Страницы книги">
          {index > 0 && (
            <button
              onClick={() => select(index - 1)}
              aria-label="Предыдущая глава"
            >
              ←
            </button>
          )}
          <span aria-label={`Глава ${index + 1} из ${count}`}>
            {roman(index + 1)} / {roman(count)}
          </span>
          {opening && (
            <button className="turn-next" onClick={() => select(index + 1)}>
              Листать дальше →
            </button>
          )}
          {index > 0 && index + 1 < count && (
            <button
              onClick={() => select(index + 1)}
              aria-label="Следующая глава"
            >
              →
            </button>
          )}
        </nav>
      </div>
      <div className="leaf recto-photo">
        <div className="carving">
          <MediaFrame
            mediaId={chapter.photo}
            sizes="(max-width: 800px) 80vw, 42vw"
            eager={opening}
          />
        </div>
      </div>
    </section>
  );
}
