import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { TerritoryMap } from "./territory-map";

test("the mobile filter strip explains that categories can be scrolled", () => {
  const markup = renderToStaticMarkup(
    <TerritoryMap objects={[]} intro={<h1>Карта</h1>}>
      <g />
    </TerritoryMap>,
  );

  assert.match(markup, /id="territory-filter-hint"/);
  assert.match(markup, /Листайте категории/);
  assert.match(markup, /aria-describedby="territory-filter-hint"/);
});
