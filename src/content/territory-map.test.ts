import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MapBuildings } from "../components/territory-map/map-buildings";
import { MapArt } from "../components/territory-map/map-art";
import { territoryBoundary, territoryObjects, matchesFilter } from "./territory-map";
import { fullView, transformView } from "./territory-view";

test("карта сохраняет номера и порядок объектов владельца", () => {
  assert.deepEqual(territoryObjects.map(({ number }) => number), [
    1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
  ]);
  assert.equal(new Set(territoryObjects.map(({ id }) => id)).size, 30);
  assert.equal(territoryObjects.flatMap(({ entrances }) => entrances).length, 16);
});

test("фильтр беседок показывает четыре утверждённых объекта", () => {
  assert.deepEqual(
    territoryObjects.filter((object) => matchesFilter(object, "gazebo")).map(({ number }) => number),
    [16, 18, 20, 29],
  );
});

test("карточки ведут к разделам без фиктивных привязок к бронированию", () => {
  const byNumber = new Map(territoryObjects.map((object) => [object.number, object]));
  assert.equal(byNumber.get(1)?.destination, "/kontakty");
  assert.equal(byNumber.get(17)?.destination, "/prozhivanie");
  assert.equal(byNumber.get(22)?.destination, "/banketnye-zaly");
  assert.equal(byNumber.get(25)?.destination, "/uslugi");
  assert.equal(byNumber.get(30)?.destination, null);
});

test("карточки двух гостиничных домов разделяют название, тип и состав номеров", () => {
  const hotels = territoryObjects.filter(({ number }) => number === 17 || number === 19);
  assert.deepEqual(hotels.map(({ cardTitle, type, description, destination }) => ({
    cardTitle, type, description, destination,
  })), ["Дом №10", "Дом №9"].map((cardTitle) => ({
    cardTitle,
    type: "Гостиничный дом",
    description: "Двухэтажный сруб на четыре двухместных номера.",
    destination: "/prozhivanie",
  })));
});

test("живописные постройки заменяются по ID и гостиничные дома делят один WebP", () => {
  const art = renderToStaticMarkup(createElement("svg", null, createElement(MapBuildings, { objects: territoryObjects })));
  const detailed = art.match(/data-map-layer="detailed-buildings"[^>]*>(.+)/)?.[1];
  assert.ok(detailed);
  assert.deepEqual(Array.from(detailed.matchAll(/data-map-art="(\d+)"/g), ([, number]) => Number(number)).sort(), [17, 19]);
  assert.equal(Array.from(art.matchAll(/href="\/art\/territory\/inn\.webp"/g)).length, 2);
  assert.equal(Array.from(art.matchAll(/href="\/art\/territory\/pool\.webp"/g)).length, 2);
  assert.doesNotMatch(art, /<symbol\b|data:image|href="[^"]+\.png"/);
  assert.equal(Array.from(art.matchAll(/data-map-art="/g)).length, 29);
});

test("у живописного фона есть отдельный мобильный AVIF и контур из реестра", () => {
  const art = renderToStaticMarkup(createElement("svg", null, createElement(MapArt, { boundary: territoryBoundary })));
  assert.match(art, /<source media="\(max-width: 670px\)" srcSet="\/art\/territory\/grove-640\.avif"/i);
  assert.match(art, /\/art\/territory\/grove-1254\.avif/);
  assert.ok(art.includes(territoryBoundary.map((point) => point.join(",")).join(" ")));
});

test("стены залов сходятся под прямыми углами", () => {
  for (const number of [21, 22]) {
    const wall = territoryObjects.find((object) => object.number === number)!.shape;
    for (const [i, [x, y]] of wall.entries()) {
      const [a, b] = wall[(i + wall.length - 1) % wall.length];
      const [c, d] = wall[(i + 1) % wall.length];
      const cosine = ((a - x) * (c - x) + (b - y) * (d - y)) /
        (Math.hypot(a - x, b - y) * Math.hypot(c - x, d - y));
      assert.ok(Math.abs(cosine) < 0.01, `зал ${number}, угол ${i}`);
    }
  }
});

test("приближение сохраняет точку под курсором и ограничивает панораму", () => {
  const zoomed = transformView(fullView, 2, [300, 240], [0, 0]);
  assert.equal(zoomed.width, fullView.width / 2);
  assert.equal(zoomed.x, 133);
  assert.equal(zoomed.y, 110);
  const panned = transformView(zoomed, 1, [300, 240], [5000, -5000]);
  assert.equal(panned.x, fullView.x + fullView.width - zoomed.width);
  assert.equal(panned.y, fullView.y);
  assert.deepEqual(transformView(zoomed, 0.1, [300, 240], [0, 0]), fullView);
});

test("утверждённые миниатюры показывают один общий сруб и по одному изображению каждого зала", () => {
  const art = renderToStaticMarkup(createElement("svg", null, createElement(MapBuildings, { objects: territoryObjects })));
  const sprites = Array.from(art.matchAll(/data-map-art="([^"]+)"[^>]*>((?:<image[^>]*><\/image>)+)<\/g>/g),
    ([, numbers, images]) => [numbers, Array.from(images.matchAll(/href="([^"]+)"/g), ([, href]) => href)]);
  assert.deepEqual(sprites.filter(([numbers]) => /^(10 11|10|11|21|22)$/.test(String(numbers))), [
    ["21", ["/art/territory/object-21-map.webp"]],
    ["22", ["/art/territory/object-22-map.webp"]],
    ["10 11", ["/art/territory/object-10-11-map.webp"]],
  ]);
});

test("новая партия миниатюр привязана к шести отдельным объектам", () => {
  const art = renderToStaticMarkup(createElement("svg", null, createElement(MapBuildings, { objects: territoryObjects })));
  const sprites = [
    [16, "object-16-map"],
    [18, "object-18-map"],
    [26, "object-26-map"],
    [27, "object-27-28-shared-map"],
    [28, "object-27-28-shared-map"],
    [29, "object-29-map"],
  ] as const;
  for (const [number, sprite] of sprites) {
    const artwork = art.split(`data-map-art="${number}"`).slice(1);
    assert.equal(artwork.length, 1);
    const group = artwork[0].split("</g>", 1)[0];
    assert.deepEqual(Array.from(group.matchAll(/href="([^"]+)"/g), ([, href]) => href), [
      `/art/territory/${sprite}.webp`,
    ]);
  }
});
