import assert from "node:assert/strict";
import test from "node:test";
import { siteDefaults } from "./defaults";
import { hasSiteKey, parseSiteData, CmsError } from "./model";

test("all current static content can be imported into the CMS", () => {
  for (const [key, value] of Object.entries(siteDefaults)) {
    assert(hasSiteKey(key));
    assert.deepEqual(parseSiteData(key, value), value);
  }
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
