import { strict as assert } from "node:assert";
import test from "node:test";
import sharp from "sharp";
import { prepareCmsImage } from "../server/cms/image";

test("uploaded photos are re-encoded, resized and have stable content identities", async () => {
  const source = await sharp({
    create: { width: 2400, height: 1200, channels: 3, background: "#eaaf76" },
  })
    .jpeg()
    .toBuffer();
  const { asset, bytes } = await prepareCmsImage(source);
  assert.match(asset.src, /^\/cms-media\/[a-f0-9]{64}\.webp$/);
  assert.equal(asset.width, 1800);
  assert.equal(asset.height, 900);
  assert.equal((await sharp(bytes).metadata()).format, "webp");
  assert.equal((await prepareCmsImage(source)).asset.id, asset.id);
});

test("non-picture bytes and SVG uploads are rejected", async () => {
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>',
  );
  await assert.rejects(prepareCmsImage(svg));
  await assert.rejects(prepareCmsImage(Buffer.from("not an image")));
});
