import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { imageSize } from "image-size";

import { mediaCatalog, resolveMedia } from "./media";
import { eventsChapter } from "./home";

test("media catalog exposes unique, descriptive assets with known sources", () => {
  const assets = Object.values(mediaCatalog);
  const ids = assets.map((asset) => asset.id);
  const sources = assets.map((asset) => asset.src);

  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(sources).size, sources.length);

  for (const asset of assets) {
    assert.ok(asset.alt.length > 12, `${asset.id} needs a useful alt text`);
    assert.ok(asset.description.length > 20, `${asset.id} needs an editorial description`);
    assert.match(asset.src, /^\/images\/rublevka\//);
    assert.ok(
      asset.sourceUrl === asset.src ||
        ["https://rublevka34.com", "https://meropriyatiya.allqbit.ru"].includes(
          new URL(asset.sourceUrl).origin,
        ),
    );
    assert.ok(asset.width > 0);
    assert.ok(asset.height > 0);

    const filePath = path.resolve(process.cwd(), "public", asset.src.slice(1));
    assert.ok(existsSync(filePath), `${asset.id} points to a missing local file`);

    const dimensions = imageSize(readFileSync(filePath));
    assert.equal(dimensions.width, asset.width, `${asset.id} has an incorrect catalog width`);
    assert.equal(dimensions.height, asset.height, `${asset.id} has an incorrect catalog height`);
  }
});

test("resolveMedia returns a configured asset by its stable id", () => {
  assert.equal(resolveMedia("house-oaks").id, "house-oaks");
});

test("the events chapter uses the owner-provided banquet hall photo", () => {
  assert.equal(eventsChapter.photo, "book-events-banquet");
  assert.equal(resolveMedia("book-events-banquet").id, "book-events-banquet");
});

test("resolveMedia rejects an unknown id", () => {
  assert.throws(() => resolveMedia("missing-asset"), /Unknown media asset/);
});
