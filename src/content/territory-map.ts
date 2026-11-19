import source from "../../docs/territory-map/objects.json";
import type { Point } from "./territory-view";
import { destinations, type MapDestination, type TerritoryObject } from "./territory-map-types";

export { matchesFilter } from "./territory-map-types";

const kinds = {
  reception: ["Ресепшн", "infrastructure"],
  lodging: ["Проживание", "lodging"],
  gazebo: ["Беседка", "gazebo"],
  banquet: ["Банкетный зал", "banquet"],
  pool: ["Бассейн", "leisure"],
  activity: ["Площадка", "leisure"],
  landmark: ["Ориентир", "leisure"],
  utility: ["Инфраструктура", "infrastructure"],
} as const;

type Input = (typeof source.objects)[number];
const asPoint = (p: readonly number[]): Point => [p[0], p[1]];
export const territoryBoundary = source.boundary_on_annotated_plan.map(asPoint);

const entranceAngles = { north: 0, east: 90, south: 180, west: 270 };
const steppedBuildings: Partial<Record<number, readonly Point[]>> = {
  1: [[-9, 306], [9, 306], [9, 341], [33, 341], [33, 362], [-9, 362]],
  22: [
    [516, 307], [568, 307], [568, 321], [591, 321], [591, 389], [563, 389],
    [563, 426], [594, 426], [594, 489], [568, 489], [568, 504], [500, 504],
    [500, 491], [478, 491], [478, 459], [491, 459], [491, 425], [518, 425],
    [518, 385], [499, 385], [499, 363], [493, 363], [493, 323], [516, 323],
  ],
};
const rounded = (value: number) => Math.round(value * 100) / 100;

function footprint(object: Input): readonly Point[] {
  const stepped = steppedBuildings[object.number];
  const [a, b, c, d] = object.footprint;
  const angle = stepped ? -Math.PI / 15 :
    Math.atan2(b[1] - a[1] + c[1] - d[1], b[0] - a[0] + c[0] - d[0]);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const world = ([x, y]: Point): Point => [
    rounded(x * cos - y * sin),
    rounded(x * sin + y * cos),
  ];

  if (stepped) return stepped.map(world);
  if (object.category === "activity") {
    return object.footprint.map(asPoint);
  }

  const [p, q, r, s] = object.footprint.map(([x, y]) => [
    x * cos + y * sin,
    -x * sin + y * cos,
  ]);
  const left = (p[0] + s[0]) / 2 + 1;
  const right = (q[0] + r[0]) / 2 - 1;
  const top = (p[1] + q[1]) / 2 + 1;
  const bottom = (r[1] + s[1]) / 2 - 1;
  const corners: Point[] = [[left, top], [right, top], [right, bottom], [left, bottom]];
  return corners.map(world);
}

const descriptions: Partial<Record<number, string>> = {
  1: "Здесь можно обратиться к администратору комплекса.",
  6: "Дом-баня из сруба.",
  12: "Стол для настольного тенниса.",
  13: "Игровая площадка для детей.",
  14: "Мельница служит ориентиром на территории.",
  15: "Место для отдыха у костра со скамейками.",
  23: "Открытая площадка для торжеств.",
  24: "Малый бассейн находится рядом с «Зелёной» беседкой.",
  25: "Большой бассейн находится рядом с VIP-домом №2.",
  30: "Кирпичное хозяйственное здание.",
  31: "Уличный туалет в деревянном срубе.",
};

function description(object: Input): string {
  if (object.room_count === 4 && object.guests_per_room === 2) {
    return "В корпусе четыре двухместных номера.";
  }
  return descriptions[object.number] ??
    (object.construction === "log" ? "Деревянный сруб." :
      object.construction === "modular" ? "Отдельный модульный дом." :
        "Беседка на территории комплекса.");
}

function destination(path: string | null): MapDestination | null {
  return path && Object.hasOwn(destinations, path) ? (path as MapDestination) : null;
}

export const territoryObjects: readonly TerritoryObject[] = source.objects.map((object) => {
  const [type, filter] = kinds[object.category as keyof typeof kinds];
  return {
    shape: footprint(object),
    id: object.id,
    number: object.number,
    name: object.name,
    category: object.category,
    marker: asPoint(object.label),
    type,
    filter,
    description: description(object),
    capacity: object.capacity_guests ?? null,
    destination: destination(object.destination),
    entrances: object.entrances.map(({ tip, side }) => ({
      tip: asPoint(tip),
      angle: entranceAngles[side as keyof typeof entranceAngles],
    })),
  };
});
