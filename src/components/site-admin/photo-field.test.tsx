import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { siteDefaults } from "@/server/cms/defaults";
import { PhotosField } from "./photo-field";

test("photo field exposes an inline file chooser beside the current preview", () => {
  const html = renderToStaticMarkup(
    <PhotosField
      label="Главная фотография"
      value="house-oaks"
      items={siteDefaults.media.items}
      draftMedia={[]}
      onChange={() => {}}
      onUpload={async () => "house-oaks"}
    />,
  );

  assert.match(html, /Главная фотография/);
  assert.match(html, /Выбрать фото/);
  assert.match(html, /type="file"/);
  assert.match(html, /house-oaks/);
});
