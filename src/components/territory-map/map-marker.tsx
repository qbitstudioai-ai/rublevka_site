import type { KeyboardEvent, MouseEvent } from "react";

import type { TerritoryObject } from "@/content/territory-map-types";
import type { Point } from "@/content/territory-view";

const points = (line: readonly Point[]) => line.map((point) => point.join(",")).join(" ");

function pinOffset(object: TerritoryObject): Point {
  if (object.number === 15) return [13, 8];
  const xs = object.shape.map(([left]) => left);
  const width = Math.max(...xs) - Math.min(...xs);
  const inn = object.number === 17 || object.number === 19;
  return [-Math.min(width * (inn ? 0.72 : 0.43), inn ? 40 : 29), object.category === "pool" ? 12 : 8];
}

export function mapPinPosition(object: TerritoryObject): Point {
  const [x, y] = object.marker;
  const [dx, dy] = pinOffset(object);
  return [x + dx, y + dy];
}

export function MapMarker({
  object,
  visible,
  selected,
  select,
  reveal,
}: {
  object: TerritoryObject;
  visible: boolean;
  selected: boolean;
  select: (trigger: SVGGElement) => void;
  reveal: (point: Point) => void;
}) {
  const [x, y] = object.marker;
  const contour = points(object.shape);
  const [dx, dy] = pinOffset(object);

  function onKeyDown(event: KeyboardEvent<SVGGElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select(event.currentTarget);
    }
  }

  function onClick(event: MouseEvent<SVGGElement>) {
    select(event.currentTarget);
  }

  return (
    <g
      className="map-marker"
      data-number={object.number}
      data-filter={object.filter}
      data-category={object.category}
      data-muted={!visible || undefined}
      role="button"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible || undefined}
      aria-pressed={selected}
      aria-label={`№${object.number} — ${object.name}`}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onFocus={(event) => {
        if (event.currentTarget.matches(":focus-visible")) reveal([x + dx, y + dy]);
      }}
    >
      <g data-map-layer="hit-zone" aria-hidden="true">
        <polygon className="map-footprint" points={contour} />
        <circle className="map-hit" cx={x} cy={y} r="18" />
      </g>
      <g className="map-marker-display" data-map-layer="marker" aria-hidden="true">
        <polygon className="map-selection-outline" points={contour} />
        {object.entrances.map(({ tip, angle }) => (
          <path key={tip.join(",")} className="map-entrance" d="M-4-13L0-7L4-13M0-16V-7" transform={`translate(${tip.join(" ")}) rotate(${angle})`}>
            <title>Отмеченный вход</title>
          </path>
        ))}
        <g className="map-pin-label" transform={`translate(${dx} ${dy})`}>
          <circle className="map-pin" cx={x} cy={y} r="14" />
          <text className="map-number" x={x} y={y + 0.75}>{object.number}</text>
        </g>
      </g>
    </g>
  );
}
