import assert from "node:assert/strict";
import test from "node:test";
import { siteDefaults } from "./defaults";
import { hasSiteKey, parseSiteData, photoReferences, CmsError } from "./model";

test("all current static content can be imported into the CMS", () => {
  for (const [key, value] of Object.entries(siteDefaults)) {
    assert(hasSiteKey(key));
    assert.deepEqual(parseSiteData(key, value), value);
  }
});

test("legacy books retain their three edited chapters and gain one manifesto without a photo", () => {
  const legacy = {
    ...siteDefaults.book,
    chapters: structuredClone(siteDefaults.book.chapters.slice(0, 3)),
  };
  legacy.chapters[1].title = "Заголовок редактора";
  const book = parseSiteData("book", legacy);
  assert.deepEqual(book.chapters.slice(0, 3), legacy.chapters);
  assert.equal(legacy.chapters.length, 3);
  assert.equal(book.chapters.length, 4);
  assert.equal(book.chapters[3].id, "chapter-4");
  assert.equal(book.chapters[3].layout, "manifesto");
  assert.equal(book.chapters[3].label, "Душа Рублевки");
  assert.equal(photoReferences("book", book).length, 3);
  assert.deepEqual(parseSiteData("book", book), book);
});

test("the manifesto requires its full copy and cannot take the place of another chapter", () => {
  const book = structuredClone(siteDefaults.book);
  const chapter = book.chapters[3];
  assert.ok(chapter?.layout === "manifesto");
  assert.throws(() => parseSiteData("book", {
    ...book,
    chapters: [...book.chapters.slice(0, 3), { ...chapter, subtitle: " " }],
  }), CmsError);
  assert.throws(() => parseSiteData("book", {
    ...book,
    chapters: [...book.chapters.slice(0, 3), { ...chapter, photo: "bath-detail" }],
  }), CmsError);
  [book.chapters[2], book.chapters[3]] = [chapter, book.chapters[2]];
  assert.throws(() => parseSiteData("book", book), CmsError);
});

test("stable room IDs, page SEO, book structure and media URLs are checked on the server", () => {
  const lodging = structuredClone(siteDefaults.prozhivanie);
  lodging.items[0].room = "family";
  assert.throws(() => parseSiteData("prozhivanie", lodging), CmsError);

  const seo = structuredClone(siteDefaults.kontakty);
  seo.title = " ";
  assert.throws(() => parseSiteData("kontakty", seo), CmsError);

  const book = structuredClone(siteDefaults.book);
  book.chapters[0].layout = "closing";
  assert.throws(() => parseSiteData("book", book), CmsError);

  const media = structuredClone(siteDefaults.media);
  media.items[0].src = "/api/admin";
  assert.throws(() => parseSiteData("media", media), CmsError);

  assert.equal(hasSiteKey("constructor"), false);
});
