import type { Point } from "./territory-view";

export const categories = {
  all: "Все объекты",
  lodging: "Проживание",
  gazebo: "Беседки",
  banquet: "Банкетные залы",
  leisure: "Услуги и отдых",
  infrastructure: "Инфраструктура",
} as const;

export type MapFilter = keyof typeof categories;

export const destinations = {
  "/prozhivanie": "К проживанию",
  "/besedki": "К беседкам",
  "/banketnye-zaly": "К банкетным залам",
  "/uslugi": "К услугам",
  "/kontakty": "К контактам",
} as const;

export type MapDestination = keyof typeof destinations;

export type TerritoryObject = {
  id: string;
  number: number;
  name: string;
  cardTitle?: string;
  category: string;
  type: string;
  filter: Exclude<MapFilter, "all">;
  description: string;
  capacity: number | null;
  destination: MapDestination | null;
  shape: readonly Point[];
  marker: Point;
  pin?: Point;
  entrances: readonly { tip: Point; angle: number }[];
};

export function mapPinOffset(object: TerritoryObject): Point {
  const [x, y] = object.marker;
  if (object.pin) return [object.pin[0] - x, object.pin[1] - y];
  if (object.number === 15) return [13, 8];
  const xs = object.shape.map(([left]) => left);
  const width = Math.max(...xs) - Math.min(...xs);
  const inn = object.number === 17 || object.number === 19;
  return [-Math.min(width * (inn ? 0.72 : 0.43), inn ? 40 : 29), object.category === "pool" ? 12 : 8];
}

export function mapPinPosition(object: TerritoryObject): Point {
  if (object.pin) return object.pin;
  const [x, y] = object.marker;
  const [dx, dy] = mapPinOffset(object);
  return [x + dx, y + dy];
}

export function matchesFilter(object: TerritoryObject, filter: MapFilter): boolean {
  return filter === "all" || object.filter === filter;
}
