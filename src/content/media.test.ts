import assert from "node:assert/strict";
import test from "node:test";

import { mediaCatalog, resolveMedia } from "./media.ts";

test("media catalog exposes unique, descriptive assets from the official site", () => {
  const assets = Object.values(mediaCatalog);
  const ids = assets.map((asset) => asset.id);

  assert.equal(new Set(ids).size, ids.length);

  for (const asset of assets) {
    assert.ok(asset.alt.length > 12, `${asset.id} needs a useful alt text`);
    assert.ok(asset.description.length > 20, `${asset.id} needs an editorial description`);
    assert.match(asset.src, /^\/images\/rublevka\//);
    assert.match(asset.sourceUrl, /^https:\/\/rublevka34\.com\//);
    assert.ok(asset.width > 0);
    assert.ok(asset.height > 0);
  }
});

test("resolveMedia returns a configured asset by its stable id", () => {
  assert.equal(resolveMedia("house-oaks").id, "house-oaks");
});

test("resolveMedia rejects an unknown id", () => {
  assert.throws(() => resolveMedia("missing-asset"), /Unknown media asset/);
});
