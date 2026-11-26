import assert from "node:assert/strict";
import test from "node:test";
import { siteDefaults } from "./defaults";
import { replaceMediaFile } from "./media-replacement";
import { parseSiteData } from "./model";

test("a previously uploaded photo can be replaced while its page references stay valid", () => {
  const first = "a".repeat(64);
  const second = "b".repeat(64);
  const original = {
    ...siteDefaults.media.items[0],
    id: "upload-" + first,
    src: "/cms-media/" + first + ".webp",
    sourceUrl: "/cms-media/" + first + ".webp",
  };
  const src = "/cms-media/" + second + ".webp";
  const replacement = replaceMediaFile(original, { ...original, id: "upload-" + second, src, sourceUrl: src });
  const [saved] = parseSiteData("media", { items: [replacement] }).items;
  assert.equal(saved.id, original.id);
  assert.equal(saved.src, src);
});

test("replacement keeps editorial identity and crop while changing file metadata", () => {
  const current = siteDefaults.media.items.find(
    (item) => item.id === "house-oaks",
  );
  assert.ok(current);
  const digest = "b".repeat(64);
  const uploaded = {
    ...current,
    id: `upload-${digest}`,
    src: `/cms-media/${digest}.webp`,
    sourceUrl: `/cms-media/${digest}.webp`,
    width: 1500,
    height: 1000,
    name: "Новая фотография",
    alt: "",
    description: "",
    focalPoint: "50% 50%" as const,
  };

  const result = replaceMediaFile(
    { ...current, name: "Дом" },
    uploaded,
  );

  assert.equal(result.id, "house-oaks");
  assert.equal(result.name, "Дом");
  assert.equal(result.alt, current.alt);
  assert.equal(result.description, current.description);
  assert.equal(result.focalPoint, current.focalPoint);
  assert.equal(result.src, uploaded.src);
  assert.equal(result.width, 1500);
});
