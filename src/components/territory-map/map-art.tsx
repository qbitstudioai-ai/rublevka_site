import type { Point } from "@/content/territory-view";

export function MapArt({ boundary }: { boundary: readonly Point[] }) {
  return (
    <g className="map-art" data-map-layer="terrain" aria-hidden="true">
      <foreignObject x="0" y="0" width="906" height="876">
        <picture className="territory-terrain">
          <source media="(max-width: 670px)" srcSet="/art/territory/grove-640.avif" />
          <source media="(max-width: 1199px)" srcSet="/art/territory/grove-960.avif" />
          <img src="/art/territory/grove-1254.avif" width="1254" height="1254" alt="" fetchPriority="high" />
        </picture>
      </foreignObject>
      <polygon className="map-boundary" points={boundary.map((point) => point.join(",")).join(" ")} />
    </g>
  );
}
