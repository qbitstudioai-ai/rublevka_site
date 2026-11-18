import { chapterLinks } from "@/content/home";

export function ChapterNav() {
  return (
    <header className="story-nav">
      <a className="story-nav__brand" href="#chapter-1" aria-label="Рублевка — к началу">
        Рублёвка
      </a>
      <nav aria-label="Главы прототипа">
        <ol className="story-nav__chapters">
          {chapterLinks.map((chapter) => (
            <li key={chapter.number}>
              <a href={chapter.href} aria-label={`${chapter.number}. ${chapter.label}`}>
                {chapter.number}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </header>
  );
}
