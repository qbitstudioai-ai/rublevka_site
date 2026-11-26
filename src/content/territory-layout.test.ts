import assert from "node:assert/strict";
import test from "node:test";

import { applyTerritoryLayout, parseTerritoryLayout } from "./territory-layout";
import { territoryObjects } from "./territory-map";
import { mapBuildingSprites } from "../components/territory-map/map-buildings";
import { mapPinPosition } from "../components/territory-map/map-marker";

test("контур перемещает зону выбора и сохраняет положение номера", () => {
  const object = territoryObjects[0];
  const shape = [[10, 20], [30, 20], [30, 40], [10, 40]];
  const [edited] = applyTerritoryLayout([object], parseTerritoryLayout({ objects: { [object.id]: { shape } } }));
  assert.deepEqual(edited.shape, shape);
  assert.deepEqual(edited.marker, [20, 30]);
  assert.deepEqual(mapPinPosition(edited), mapPinPosition(object));
  assert.equal(edited.entrances, object.entrances);
});

test("общая миниатюра сруба двигается один раз и сохраняет пропорции", () => {
  const layout = parseTerritoryLayout({ illustrations: { "object-10": { x: 190, y: 350, width: 135 } } });
  const sprites = mapBuildingSprites(territoryObjects, layout.illustrations);
  const shared = sprites.filter(({ numbers }) => numbers === "10 11");
  assert.equal(shared.length, 1);
  assert.deepEqual(shared.map(({ x, y, width, height }) => [x, y, width, height]), [[190, 350, 135, 68]]);
  assert.equal(sprites.some(({ id }) => id === "object-11"), false);
});

test("файл правок отклоняет некорректные размеры и контуры", () => {
  assert.throws(() => parseTerritoryLayout({ illustrations: { "object-10": { x: 0, y: 0, width: 0 } } }));
  assert.throws(() => parseTerritoryLayout({ objects: { "object-10": { shape: [[1, 2], [3, 4]] } } }));
  assert.throws(() => parseTerritoryLayout({ objects: { "object-10": { name: "Новое имя" } } }));
});
