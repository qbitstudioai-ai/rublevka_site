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

test("legacy four-chapter books gain events second without losing edited content", () => {
  const legacy = structuredClone(siteDefaults.book);
  legacy.chapters.splice(1, 1);
  legacy.chapters.forEach((chapter, index) => {
    chapter.id = `chapter-${index + 1}`;
  });
  assert.deepEqual(legacy.chapters.map((chapter) => chapter.layout), [
    "opening", "index", "closing", "manifesto",
  ]);
  legacy.chapters[1].title = "Заголовок редактора";
  const original = structuredClone(legacy.chapters);

  const book = parseSiteData("book", legacy);

  assert.deepEqual(book.chapters.map((chapter) => chapter.layout), [
    "opening", "events", "index", "closing", "manifesto",
  ]);
  assert.deepEqual(book.chapters.map((chapter) => chapter.id), [
    "chapter-1", "chapter-2", "chapter-3", "chapter-4", "chapter-5",
  ]);
  assert.deepEqual(book.chapters[0], original[0]);
  assert.deepEqual({ ...book.chapters[2], id: "chapter-2" }, original[1]);
  assert.deepEqual({ ...book.chapters[3], id: "chapter-3" }, original[2]);
  assert.deepEqual({ ...book.chapters[4], id: "chapter-4" }, original[3]);
  assert.equal(photoReferences("book", book).length, 4);
});

test("only events can be published without a photo", () => {
  const book = structuredClone(siteDefaults.book) as { chapters: Array<Record<string, unknown>> };
  delete book.chapters[1].photo;

  const parsed = parseSiteData("book", book, { allowLegacyBook: false });
  assert.equal(parsed.chapters[1].layout, "events");
  assert.deepEqual(photoReferences("book", parsed), [
    "book-opening-house", "book-autumn-gazebo", "book-golden-grove",
  ]);

  delete book.chapters[0].photo;
  assert.throws(() => parseSiteData("book", book, { allowLegacyBook: false }), CmsError);
});

test("a book must contain all five ordered chapters after legacy migration", () => {
  const incomplete = structuredClone(siteDefaults.book);
  incomplete.chapters.pop();

  assert.throws(() => parseSiteData("book", incomplete), CmsError);
});

test("the manifesto requires its full copy and cannot take the place of another chapter", () => {
  const book = structuredClone(siteDefaults.book);
  const chapter = book.chapters[4];
  assert.ok(chapter?.layout === "manifesto");
  assert.throws(() => parseSiteData("book", {
    ...book,
    chapters: [...book.chapters.slice(0, 4), { ...chapter, subtitle: " " }],
  }), CmsError);
  assert.throws(() => parseSiteData("book", {
    ...book,
    chapters: [...book.chapters.slice(0, 4), { ...chapter, photo: "bath-detail" }],
  }), CmsError);
  [book.chapters[3], book.chapters[4]] = [chapter, book.chapters[3]];
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

test("a built-in media identity may point to a validated CMS replacement", () => {
  const media = structuredClone(siteDefaults.media);
  const asset = media.items.find((item) => item.id === "house-oaks");
  assert.ok(asset);
  const digest = "a".repeat(64);
  Object.assign(asset, {
    src: `/cms-media/${digest}.webp`,
    sourceUrl: `/cms-media/${digest}.webp`,
    width: 1600,
    height: 900,
  });

  assert.deepEqual(parseSiteData("media", media), media);

  asset.sourceUrl = "/cms-media/" + "b".repeat(64) + ".webp";
  assert.throws(() => parseSiteData("media", media), CmsError);
});
