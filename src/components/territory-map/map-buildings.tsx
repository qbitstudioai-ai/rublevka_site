import type { ComponentType, ReactNode } from "react";
import type { TerritoryObject } from "@/content/territory-map-types";
import type { Point } from "@/content/territory-view";

import { CarvedInn, CarvedInnDefinitions } from "./carved-inn";

type DetailedModel = {
  Artwork: ComponentType<{ object: TerritoryObject }>;
  Definitions: ComponentType;
};
const carvedInn: DetailedModel = { Artwork: CarvedInnPlacement, Definitions: CarvedInnDefinitions };
const detailedModels = new Map<string, DetailedModel>([
  ["object-17", carvedInn],
  ["object-19", carvedInn],
]);

const round = (value: number) => Math.round(value * 10) / 10;
const points = (list: readonly Point[]) => list.map(([x, y]) => `${round(x)},${round(y)}`).join(" ");
const lift = (x: number, y: number, z: number): Point => [x - z * 0.26, y - z * 0.88];

function boxCoordinates(shape: readonly Point[]) {
  const [a, b, , d] = shape;
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
  return {
    transform: `translate(${a.join(" ")}) rotate(${round(angle)})`,
    width: Math.hypot(b[0] - a[0], b[1] - a[1]),
    depth: Math.hypot(d[0] - a[0], d[1] - a[1]),
  };
}

function CarvedInnPlacement({ object }: { object: TerritoryObject }) {
  const { transform, width, depth } = boxCoordinates(object.shape);
  return <g transform={transform}><CarvedInn width={width} depth={depth} /></g>;
}

type Box = { width: number; depth: number; height: number; gallery?: boolean };

function Roof({ width, depth, height }: Box) {
  const pitch = Math.min(depth * 0.2, 16);
  const overhang = 2;
  const nearLeft = lift(-overhang, depth + overhang, height);
  const nearRight = lift(width + overhang, depth + overhang, height);
  const farLeft = lift(-overhang, -overhang, height);
  const farRight = lift(width + overhang, -overhang, height);
  const crestLeft = lift(-overhang, depth / 2, height + pitch);
  const crestRight = lift(width + overhang, depth / 2, height + pitch);
  const face = [crestLeft, crestRight, nearRight, nearLeft];
  const scallops = Array.from({ length: Math.floor(width / 4) }, () => "q2 2.6 4 0").join("");
  return (
    <>
      <polygon className="relief-gable" points={points([farRight, crestRight, nearRight])} />
      <polygon className="relief-roof-dark" points={points([farLeft, farRight, crestRight, crestLeft])} />
      <polygon className="relief-roof" points={points(face)} />
      <polygon className="relief-roof-glaze" points={points(face)} fill="url(#territory-roof-glaze)" />
      <polygon className="relief-shingles" points={points(face)} fill="url(#territory-shingles)" />
      <polyline className="relief-fascia" points={points([farRight, crestRight, nearRight, nearLeft])} />
      <polyline className="relief-crest" points={points([crestLeft, crestRight])} />
      <path className="relief-carving" d={`M${points([lift(width + 1, 0, height), crestRight, lift(width + 1, depth, height)])}`} />
      <path className="relief-eaves" d={`M${round(nearLeft[0] + 2)} ${round(nearLeft[1] + 0.2)}${scallops}`} />
    </>
  );
}

function Cabin({ width, depth, height, gallery = false }: Box) {
  const corners: Point[] = [[0, 0], [width, 0], [width, depth], [0, depth]];
  const slots = gallery ? 4 : width > 48 ? 3 : 2;
  const windows = Array.from({ length: slots }, (_, i) => width * (i + 1) / (slots + 1));
  const levels = height > 18 ? [5, 13] : [4];
  const trim = height > 12 ? 1.25 : 0.9;
  return (
    <>
      <polygon className="relief-shadow" points={points(corners)} transform="translate(5 7)" />
      <polygon className="relief-wall-dark" points={points([[width, 0], [width, depth],
        lift(width, depth, height), lift(width, 0, height)])} />
      <polygon className="relief-wall" points={points([[0, depth], [width, depth],
        lift(width, depth, height), lift(0, depth, height)])} />
      {Array.from({ length: Math.floor(height / 2.5) }, (_, index) => {
        const z = (index + 1) * 2.5;
        return <polyline key={z} className="relief-log" points={points([
          lift(0, depth, z), lift(width, depth, z), lift(width, 0, z),
        ])} />;
      })}
      {levels.flatMap((z) => windows.map((x) => {
        const [u, v] = lift(x, depth, z);
        return (
          <g key={`${x}-${z}`} transform={`translate(${round(u)} ${round(v)})`}>
            <rect className="relief-window" x={-2.8 * trim} y={-3.2 * trim} width={5.6 * trim} height={5.1 * trim} rx={0.45} />
            <path className="relief-window-cross" d={`M0 ${-3 * trim}V${1.7 * trim}M${-2.5 * trim} ${-0.7 * trim}H${2.5 * trim}`} />
          </g>
        );
      }))}
      <Roof width={width} depth={depth} height={height} />
    </>
  );
}

function Pavilion({ width, depth, height }: Box) {
  const corners: Point[] = [[0, 0], [width, 0], [width, depth], [0, depth]];
  const eaves = corners.map(([x, y]) => lift(x, y, height));
  const top = lift(width / 2, depth / 2, height + Math.min(depth * 0.2, 12));
  return (
    <>
      <polygon className="relief-shadow" points={points(corners)} transform="translate(4 6)" />
      <polygon className="relief-deck" points={points(corners)} />
      {corners.map(([x, y], i) => <polyline key={i} className="relief-post" points={points([[x, y], eaves[i]])} />)}
      <polyline className="relief-lattice" points={points([
        lift(0, depth, 4), lift(width * 0.2, depth, 1), lift(width * 0.4, depth, 4),
        lift(width * 0.6, depth, 1), lift(width * 0.8, depth, 4), lift(width, depth, 1),
      ])} />
      <polygon className="relief-roof-dark" points={points(eaves)} />
      <polygon className="relief-roof" points={points([eaves[2], eaves[3], top])} />
      <polygon className="relief-roof-glaze" fill="url(#territory-roof-glaze)" points={points([eaves[2], eaves[3], top])} />
      <polygon className="relief-shingles" fill="url(#territory-shingles)" points={points([eaves[2], eaves[3], top])} />
      <polyline className="relief-crest" points={points([eaves[0], top, eaves[2]])} />
      <polyline className="relief-fascia" points={points([eaves[1], eaves[2], eaves[3]])} />
      <circle className="relief-finial" cx={top[0]} cy={top[1]} r="2.1" />
    </>
  );
}

function SteppedBuilding({ object }: { object: TerritoryObject }) {
  const { shape, number } = object;
  const height = number === 22 ? 15 : 9;
  const { transform } = boxCoordinates(shape);
  const wings = number === 22
    ? [{ x: 6, y: 55, width: 40, depth: 68, height: 12 },
      { x: -18, y: 17, width: 89, depth: 65, height: 18 },
      { x: -31, y: 123, width: 105, depth: 62, height: 20 }]
    : [{ x: 1, y: 0, width: 16, depth: 48, height: 10 },
      { x: 14, y: 34, width: 27, depth: 21, height: 9 }];
  return (
    <>
      <polygon className="relief-shadow" points={points(shape)} transform="translate(5 7)" />
      {shape.map(([x, y], index) => {
        const [nextX, nextY] = shape[(index + 1) % shape.length];
        return (
          <polygon
            key={index}
            className={nextY > y ? "relief-wall-dark" : "relief-wall"}
            points={points([[x, y], [nextX, nextY], lift(nextX, nextY, height), lift(x, y, height)])}
          />
        );
      })}
      <polygon className="relief-roof-dark" points={points(shape.map(([x, y]) => lift(x, y, height)))} />
      <g transform={transform}>
        {wings.map(({ x, y, ...box }) => (
          <g key={y} transform={`translate(${x} ${y})`}>
            <Cabin {...box} gallery={number === 22 && box.width > 80} />
          </g>
        ))}
      </g>
    </>
  );
}

function Pool({ width, depth }: Omit<Box, "height">) {
  const lip = 3.4;
  return (
    <>
      <rect className="relief-shadow" x="4" y="6" width={width} height={depth} rx="3" />
      <rect className="relief-pool-rim" width={width} height={depth} rx="3" />
      <rect className="relief-water" x={lip} y={lip} width={width - 2 * lip} height={depth - 2 * lip} rx="1.4" />
      <path className="relief-water-glint" d={[0.24, 0.36, 0.64, 0.73].map((y, i) =>
        `M${round(width * (i % 2 ? 0.28 : 0.2))} ${round(depth * y)}q${round(width * 0.14)} -3 ${round(width * 0.28)} 0t${round(width * 0.28)} 0`).join("")} />
      <path className="relief-pool-steps" d={`M${width * 0.55} ${lip}v7h${width * 0.24}v-7m${-width * 0.24} 3.5h${width * 0.24}`} />
    </>
  );
}

function Clearing({ object }: { object: TerritoryObject }) {
  const [x, y] = object.marker;
  return (
    <>
      <polygon className="relief-clearing" points={points(object.shape)} />
      <g transform={`translate(${x} ${y})`}>
        {object.number === 12 ? (
          <g className="relief-tennis" transform="rotate(-12)">
            <path d="M-19 3v7m38-7v7" />
            <rect x="-23" y="-9" width="46" height="15" rx="2" />
            <path d="M0-9V6M-23-1h46" />
          </g>
        ) : object.number === 13 ? (
          <g className="relief-play" transform="rotate(-12)">
            <path d="M-43 11l8-23 9 23m-9-23h30l8 23m-8-23-9 23m-10-21v13m10-13v13m-12 1h14M10 10v-23h14v23m-17-23 10-9 10 9m-3 4 24 17" />
            <circle cx="17" cy="-8" r="2" />
          </g>
        ) : object.number === 15 ? (
          <g className="relief-fire">
            <ellipse cx="0" cy="3" rx="12" ry="7" />
            <path d="M-6 4q-5-6 3-9-1-5 4-8 0 7 5 10 2 5-4 7z" />
            <path d="M-13-8l-5 5m29-5 5 5m-21 17h10" />
          </g>
        ) : (
          <g className="relief-ceremony" transform="rotate(-12)">
            <path d="M-20 10v-18Q0-27 20-8v18m-32-20v20m24-20v20" />
            <path d="M-21-7Q0-32 21-7Q0-17-21-7Z" />
          </g>
        )}
      </g>
    </>
  );
}

function BuildingArt({ object, children }: { object: TerritoryObject; children: ReactNode }) {
  return (
    <g className="map-relief" data-map-art={object.number} data-kind={object.category} data-art-filter={object.filter}>
      {children}
    </g>
  );
}

function StylizedBuilding({ object }: { object: TerritoryObject }) {
  const { number, category, shape } = object;
  if (shape.length > 4) return <SteppedBuilding object={object} />;
  if (category === "activity") return <Clearing object={object} />;
  const { transform, width, depth } = boxCoordinates(shape);
  const height = category === "banquet" || number === 27 || number === 28 ? 19 : 10;
  return (
    <g transform={transform}>
      {category === "pool" ? <Pool width={width} depth={depth} /> : category === "gazebo" ? (
        <Pavilion width={width} depth={depth} height={10} />
      ) : <Cabin width={width} depth={depth} height={height} />}
      {category === "landmark" ? (
        <path className="relief-mill" d="M8 0l17 20m1-20L8 20M7 1l5-4 7 7-5 4m5 5 5-4 7 8-5 4" />
      ) : null}
    </g>
  );
}

export function MapBuildings({ objects }: { objects: readonly TerritoryObject[] }) {
  const frontEdge = (object: TerritoryObject) => Math.max(...object.shape.map(([, y]) => y));
  const stylized: ReactNode[] = [];
  const detailed: ReactNode[] = [];
  const definitions = new Set<ComponentType>();

  for (const object of objects.toSorted((a, b) => frontEdge(a) - frontEdge(b))) {
    const model = detailedModels.get(object.id);
    if (!model) {
      stylized.push(<BuildingArt object={object} key={object.id}><StylizedBuilding object={object} /></BuildingArt>);
      continue;
    }
    const { Artwork, Definitions } = model;
    definitions.add(Definitions);
    detailed.push(
      <BuildingArt object={object} key={object.id}>
        <Artwork object={object} />
      </BuildingArt>,
    );
  }

  return (
    <g className="map-buildings" aria-hidden="true">
      <defs>{Array.from(definitions, (Definitions, index) => <Definitions key={index} />)}</defs>
      <g data-map-layer="stylized-buildings">{stylized}</g>
      <g data-map-layer="detailed-buildings">{detailed}</g>
    </g>
  );
}
