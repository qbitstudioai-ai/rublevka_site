import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { chapters } from "@/content/home";
import { resolveMedia } from "@/content/media";
import { BookCover } from "./book-cover";
import { BookPage } from "./book-page";

test("the closed cover presents the exact Rublevka invitation", () => {
  const markup = renderToStaticMarkup(
    <BookCover entry="closed" open={() => {}} opened={() => {}} />,
  );
  const visibleText = markup.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");

  assert.match(markup, /data-entry="closed"/);
  assert.equal((markup.match(/<h1(?:\s|>)/g) ?? []).length, 0);
  assert.match(visibleText, /Загородный комплекс «Рублевка»/);
  assert.match(markup, /Уехать от городского шума, чтобы отдохнуть душой\./);
  assert.match(markup, /Окунуться в волшебство загородного отдыха/);
});

test("the fourth leaf uses only the lower next-chapter arrow", () => {
  const chapter = chapters[3];
  assert.equal(chapter.layout, "closing");
  if (chapter.layout !== "closing") return;

  const markup = renderToStaticMarkup(
    <BookPage
      chapter={{ ...chapter, image: resolveMedia(chapter.photo) }}
      index={3}
      count={chapters.length}
      active
      departing={false}
      select={() => {}}
    />,
  );

  assert.doesNotMatch(markup, /Листать дальше/);
  assert.match(markup, /aria-label="Следующая глава"/);
});
