import type { IllustrationPlacement, TerritoryLayout } from "@/content/territory-layout";
import type { TerritoryObject } from "@/content/territory-map-types";
import type { Point } from "@/content/territory-view";

const sizes = {
  cottage: [244, 191], module: [244, 167], gazebo: [244, 214],
  banquet: [340, 227], reception: [244, 193], utility: [244, 187],
  pool: [244, 158], play: [244, 186], mill: [244, 317],
  fire: [244, 191], tennis: [244, 158], platform: [244, 174], inn: [360, 255],
  "object-10-11-map": [540, 272], "object-21-map": [420, 227], "object-22-map": [510, 225],
  "object-16-map": [512, 384], "object-18-map": [512, 384], "object-26-map": [512, 384],
  "object-27-28-shared-map": [512, 384], "object-29-map": [512, 384],
} as const;

type Sprite = keyof typeof sizes;

const byId: Partial<Record<string, Sprite>> = {
  "object-02": "module", "object-03": "module", "object-04": "module", "object-05": "module",
  "object-21": "object-21-map", "object-22": "object-22-map",
  "object-12": "tennis", "object-13": "play", "object-14": "mill", "object-15": "fire",
  "object-16": "object-16-map", "object-17": "inn", "object-18": "object-18-map",
  "object-19": "inn", "object-23": "platform", "object-26": "object-26-map",
  "object-27": "object-27-28-shared-map", "object-28": "object-27-28-shared-map", "object-29": "object-29-map",
};

const byCategory: Partial<Record<string, Sprite>> = {
  lodging: "cottage", gazebo: "gazebo", banquet: "banquet",
  pool: "pool", reception: "reception", utility: "utility",
};

// Align the approved illustrations with their existing footprints in map coordinates.
const placements: Partial<Record<Sprite, IllustrationPlacement>> = {
  "object-21-map": { x: 398, y: 155, width: 110 },
  "object-22-map": { x: 515, y: 229, width: 170 },
};

// Each pair renders one sprite. The second unit still renders its own marker.
const sharedBuildings: Partial<Record<string, { numbers: string; placement: IllustrationPlacement } | null>> = {
  "object-08": { numbers: "8 9", placement: { x: 221, y: 473, width: 96 } },
  "object-09": null,
  "object-10": { numbers: "10 11", placement: { x: 185, y: 336, width: 119 } },
  "object-11": null,
};

const round = (value: number) => Math.round(value * 100) / 100;

type SpriteGeometry = IllustrationPlacement & { height: number; rotationCenter?: Point };

export type BuildingIllustration = SpriteGeometry & {
  id: string;
  numbers: string | number;
  shared: boolean;
  filter: TerritoryObject["filter"];
  sprite: Sprite;
};

function spriteGeometry(object: TerritoryObject, sprite: Sprite, placement?: IllustrationPlacement): SpriteGeometry {
  const [x, y] = object.marker;
  const xs = object.shape.map(([u]) => u);
  const ys = object.shape.map(([, v]) => v);
  const span = Math.max(...xs) - Math.min(...xs);
  const depth = Math.max(...ys) - Math.min(...ys);
  const width = placement?.width ?? round(
    sprite === "pool" ? Math.min(span * 1.23, depth * 0.77) :
    sprite === "inn" ? span * 1.47 :
    Math.max(29, span * (sprite === "play" ? 0.82 : 1.22)),
  );
  const [assetWidth, assetHeight] = sizes[sprite];
  const height = round((width * assetHeight) / assetWidth);
  if (placement) return { x: round(placement.x), y: round(placement.y), width, height };
  if (sprite === "pool") {
    return { x: round(x - width / 2), y: round(y - height / 2), width, height, rotationCenter: [x, y] };
  }

  const ground = y + Math.min(depth * 0.17, 13);
  const verticalAnchor = object.category === "activity" ? 0.58 : 0.86;
  return { x: round(x - width / 2), y: round(ground - height * verticalAnchor), width, height };
}

export function mapBuildingSprites(
  objects: readonly TerritoryObject[],
  overrides: TerritoryLayout["illustrations"] = {},
): BuildingIllustration[] {
  const buildings: BuildingIllustration[] = [];

  for (const object of objects.toSorted((a, b) => a.marker[1] - b.marker[1])) {
    const shared = sharedBuildings[object.id];
    if (shared === null) continue;
    const sprite = shared ? "object-10-11-map" : (byId[object.id] ?? byCategory[object.category] ?? "utility");
    const original = spriteGeometry(object, sprite, shared?.placement ?? placements[sprite]);
    const edit = overrides[object.id];
    const geometry = edit ? spriteGeometry(object, sprite, edit) : original;
    if (edit && original.rotationCenter) {
      geometry.rotationCenter = [geometry.x + geometry.width / 2, geometry.y + geometry.height / 2];
    }
    buildings.push({
      ...geometry, id: object.id, numbers: shared?.numbers ?? object.number,
      shared: Boolean(shared), filter: object.filter, sprite,
    });
  }

  return buildings;
}

export function illustrationRotation({ rotationCenter }: BuildingIllustration): string | undefined {
  return rotationCenter ? `rotate(62 ${rotationCenter[0]} ${rotationCenter[1]})` : undefined;
}

export function MapBuildings({ objects, illustrations }: {
  objects: readonly TerritoryObject[];
  illustrations?: TerritoryLayout["illustrations"];
}) {
  const layers = { stylized: [], detailed: [] } as Record<"stylized" | "detailed", React.ReactNode[]>;

  for (const building of mapBuildingSprites(objects, illustrations)) {
    const { id, numbers, shared, filter, sprite, x, y, width, height } = building;
    const image = <image href={`/art/territory/${sprite}.webp`} x={x} y={y} width={width} height={height} />;
    const rotation = illustrationRotation(building);
    layers[sprite === "inn" ? "detailed" : "stylized"].push(
      <g key={id} className="map-relief" data-map-art={numbers}
        data-shared-art={shared || undefined} data-art-filter={filter}>
        {rotation ? <g transform={rotation}>{image}</g> : image}
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
