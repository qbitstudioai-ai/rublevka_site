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
  category: string;
  type: string;
  filter: Exclude<MapFilter, "all">;
  description: string;
  capacity: number | null;
  destination: MapDestination | null;
  shape: readonly Point[];
  marker: Point;
  entrances: readonly { tip: Point; angle: number }[];
};

export function matchesFilter(object: TerritoryObject, filter: MapFilter): boolean {
  return filter === "all" || object.filter === filter;
}
