import { MediaFrame } from "../ui/media-frame";
import type { Chapter, Entry } from "@/content/home";

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
  showEntry: (entry: Entry) => void;
};
export function BookPage({
  chapter,
  index,
  count,
  active,
  departing,
  select,
  showEntry,
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
              <li key={entry.media}>
                <button onClick={() => showEntry(entry)}>
                  {entry.title}
                  <span aria-hidden="true">→</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!chapter.entries && (
          <button
            className="seal"
            onClick={() => select(index + 1 < count ? index + 1 : 0)}
          >
            {index + 1 < count ? "Листать дальше" : "Вернуться к началу"}{" "}
            <span aria-hidden="true">{index + 1 < count ? "→" : "↶"}</span>
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
