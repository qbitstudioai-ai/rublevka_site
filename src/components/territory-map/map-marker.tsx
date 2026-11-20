import type { KeyboardEvent, MouseEvent } from "react";

import type { TerritoryObject } from "@/content/territory-map-types";
import type { Point } from "@/content/territory-view";

const labels: Record<number, { text: string; position: Point; anchor?: "start" }> = {
  1: { text: "Ресепшн", position: [92, 370], anchor: "start" },
  21: { text: "Малый зал", position: [447, 251] },
  22: { text: "Большой зал", position: [638, 166] },
  25: { text: "Большой бассейн", position: [774, 763] },
};
const points = (line: readonly Point[]) => line.map((point) => point.join(",")).join(" ");

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
  reveal: () => void;
}) {
  const [x, y] = object.marker;
  const label = labels[object.number];
  const contour = points(object.shape);

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
        if (event.currentTarget.matches(":focus-visible")) reveal();
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
        <g className="map-pin-label">
          <circle className="map-pin" cx={x} cy={y} r="14" />
          <text className="map-number" x={x} y={y + 0.75}>{object.number}</text>
        </g>
        {label ? (
          <text className="map-label" x={label.position[0]} y={label.position[1]} textAnchor={label.anchor ?? "middle"}>
            {label.text}
          </text>
        ) : null}
      </g>
    </g>
  );
}
