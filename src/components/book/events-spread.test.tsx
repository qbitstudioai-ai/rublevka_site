import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { chapters } from "@/content/home";
import { resolveMedia } from "@/content/media";
import { BookPage, type BookChapter } from "./book-page";

function renderChapter(index: number) {
  const chapter = chapters[index];
  assert.ok(chapter, `chapter ${index + 1} must exist`);
  const withImage: BookChapter =
    chapter.layout !== "manifesto" && chapter.photo
      ? { ...chapter, image: resolveMedia(chapter.photo) }
      : chapter;

  return renderToStaticMarkup(
    <BookPage
      chapter={withImage}
      index={index}
      count={chapters.length}
      active
      departing={false}
      select={() => {}}
    />,
  );
}

test("the opening CTA names lodging dates and keeps the booking route", () => {
  const markup = renderChapter(0);

  assert.match(markup, />Выбрать даты проживания<\/a>/);
  assert.match(markup, /href="\/bronirovanie"/);
});

test("events is the second spread with a calendar CTA and banquet photo", () => {
  const markup = renderChapter(1);

  assert.match(markup, /<h2[^>]*>Мероприятия<\/h2>/);
  assert.match(markup, /Календарь событий, которые стоит посетить/);
  assert.match(markup, /href="\/meropriyatiya"/);
  assert.match(markup, />Календарь<\/a>/);
  assert.match(markup, /data-media-id="book-events-banquet"/);
  assert.match(markup, /Празднично украшенный банкетный зал/);
});
