import type { TerritoryObject } from "@/content/territory-map-types";

const sizes = {
  cottage: [244, 191], module: [244, 167], gazebo: [244, 214],
  banquet: [340, 227], reception: [244, 193], utility: [244, 187],
  pool: [244, 158], play: [244, 186], mill: [244, 317],
  fire: [244, 191], tennis: [244, 158], platform: [244, 174], inn: [360, 255],
} as const;

type Sprite = keyof typeof sizes;

const byId: Partial<Record<string, Sprite>> = {
  "object-02": "module", "object-03": "module", "object-04": "module", "object-05": "module",
  "object-12": "tennis", "object-13": "play", "object-14": "mill", "object-15": "fire",
  "object-17": "inn", "object-19": "inn", "object-23": "platform",
};

const byCategory: Partial<Record<string, Sprite>> = {
  lodging: "cottage", gazebo: "gazebo", banquet: "banquet",
  pool: "pool", reception: "reception", utility: "utility",
};

const round = (value: number) => Math.round(value * 100) / 100;

function BuildingSprite({ object, sprite }: { object: TerritoryObject; sprite: Sprite }) {
  const [x, y] = object.marker;
  const xs = object.shape.map(([u]) => u);
  const ys = object.shape.map(([, v]) => v);
  const span = Math.max(...xs) - Math.min(...xs);
  const depth = Math.max(...ys) - Math.min(...ys);
  const width = round(
    sprite === "pool" ? Math.min(span * 1.23, depth * 0.77) :
    sprite === "inn" ? span * 1.47 :
    object.number === 22 ? span * 1.15 :
    Math.max(29, span * (sprite === "play" ? 0.82 : 1.22)),
  );
  const [assetWidth, assetHeight] = sizes[sprite];
  const height = round((width * assetHeight) / assetWidth);
  const href = `/art/territory/${sprite}.webp`;
  const image = (left: number, top: number) => (
    <image href={href} x={round(left)} y={round(top)} width={width} height={height} />
  );

  if (object.number === 22) {
    const top = y - depth * 0.47 + 5;
    return <>{image(x - width * 0.56, top)}{image(x - width * 0.43, top + depth * 0.42)}</>;
  }

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
    layers[sprite === "inn" ? "detailed" : "stylized"].push(
      <g key={object.id} className="map-relief" data-map-art={object.number} data-art-filter={object.filter}>
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
