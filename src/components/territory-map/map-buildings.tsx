import type { TerritoryObject } from "@/content/territory-map-types";

const sizes = {
  cottage: [244, 191], module: [244, 167], gazebo: [244, 214],
  banquet: [340, 227], reception: [244, 193], utility: [244, 187],
  pool: [244, 158], play: [244, 186], mill: [244, 317],
  fire: [244, 191], tennis: [244, 158], platform: [244, 174], inn: [360, 255],
  "object-10-11-map": [540, 272], "object-21-map": [420, 227], "object-22-map": [510, 225],
} as const;

type Sprite = keyof typeof sizes;

const byId: Partial<Record<string, Sprite>> = {
  "object-02": "module", "object-03": "module", "object-04": "module", "object-05": "module",
  "object-10": "object-10-11-map", "object-11": "object-10-11-map",
  "object-21": "object-21-map", "object-22": "object-22-map",
  "object-12": "tennis", "object-13": "play", "object-14": "mill", "object-15": "fire",
  "object-17": "inn", "object-19": "inn", "object-23": "platform",
};

const byCategory: Partial<Record<string, Sprite>> = {
  lodging: "cottage", gazebo: "gazebo", banquet: "banquet",
  pool: "pool", reception: "reception", utility: "utility",
};

// Align the approved illustrations with their existing footprints in map coordinates.
const placements: Partial<Record<Sprite, { x: number; y: number; width: number }>> = {
  "object-10-11-map": { x: 185, y: 336, width: 119 },
  "object-21-map": { x: 398, y: 155, width: 110 },
  "object-22-map": { x: 515, y: 229, width: 170 },
};

const round = (value: number) => Math.round(value * 100) / 100;

function BuildingSprite({ object, sprite }: { object: TerritoryObject; sprite: Sprite }) {
  const [x, y] = object.marker;
  const xs = object.shape.map(([u]) => u);
  const ys = object.shape.map(([, v]) => v);
  const span = Math.max(...xs) - Math.min(...xs);
  const depth = Math.max(...ys) - Math.min(...ys);
  const placement = placements[sprite];
  const width = placement?.width ?? round(
    sprite === "pool" ? Math.min(span * 1.23, depth * 0.77) :
    sprite === "inn" ? span * 1.47 :
    Math.max(29, span * (sprite === "play" ? 0.82 : 1.22)),
  );
  const [assetWidth, assetHeight] = sizes[sprite];
  const height = round((width * assetHeight) / assetWidth);
  const href = `/art/territory/${sprite}.webp`;
  const image = (left: number, top: number) => (
    <image href={href} x={round(left)} y={round(top)} width={width} height={height} />
  );

  if (placement) return image(placement.x, placement.y);

  if (sprite === "pool") {
    return <g transform={`rotate(62 ${x} ${y})`}>{image(x - width / 2, y - height / 2)}</g>;
  }

  const ground = y + Math.min(depth * 0.17, 13);
  const verticalAnchor = object.category === "activity" ? 0.58 : 0.86;
  return image(x - width / 2, ground - height * verticalAnchor);
}

export function MapBuildings({ objects }: { objects: readonly TerritoryObject[] }) {
  const layers = { stylized: [], detailed: [] } as Record<"stylized" | "detailed", React.ReactNode[]>;

  for (const object of objects.toSorted((a, b) => a.marker[1] - b.marker[1])) {
    const sprite = byId[object.id] ?? byCategory[object.category] ?? "utility";
    const shared = sprite === "object-10-11-map";
    if (shared && object.id === "object-11") continue;

    layers[sprite === "inn" ? "detailed" : "stylized"].push(
      <g key={object.id} className="map-relief" data-map-art={shared ? "10 11" : object.number} data-art-filter={object.filter}>
        <BuildingSprite object={object} sprite={sprite} />
      </g>,
    );
  }

  return (
    <g className="map-buildings" aria-hidden="true">
      <g data-map-layer="stylized-buildings">{layers.stylized}</g>
      <g data-map-layer="detailed-buildings">{layers.detailed}</g>
    </g>
  );
}
