import type { Point } from "@/content/territory-view";

const oaks = [
  [78, 152, 33], [126, 143, 23], [66, 213, 28], [104, 192, 24], [208, 195, 28],
  [251, 169, 23], [263, 213, 30], [311, 163, 18], [439, 69, 22], [485, 74, 25],
  [533, 68, 24], [565, 102, 29], [515, 126, 24], [594, 143, 24], [458, 286, 25],
  [397, 277, 23], [345, 301, 20], [159, 311, 25], [172, 365, 24], [166, 424, 18],
  [183, 475, 19], [155, 565, 24], [188, 585, 32], [225, 574, 23], [280, 581, 29],
  [317, 546, 20], [349, 421, 22], [363, 372, 25], [410, 355, 26], [480, 378, 20],
  [506, 407, 19], [526, 560, 24], [498, 594, 20], [536, 612, 25], [571, 593, 24],
  [632, 605, 25], [690, 583, 25], [663, 628, 15], [618, 643, 29], [567, 687, 23],
  [585, 732, 26], [547, 755, 23], [529, 715, 14], [312, 675, 27], [267, 626, 24],
  [202, 653, 23], [226, 696, 24], [792, 708, 16], [820, 701, 24], [854, 719, 20],
] as const;

export function MapArt({ boundary }: { boundary: readonly Point[] }) {
  const points = boundary.map((point) => point.join(",")).join(" ");
  return (
    <g aria-hidden="true" className="map-art">
      <defs>
        <linearGradient id="territory-land" x2="1" y2="1">
          <stop className="map-land-light" />
          <stop offset="1" className="map-land-shade" />
        </linearGradient>
        <pattern id="territory-grain" width="29" height="23" patternUnits="userSpaceOnUse">
          <path d="M3 6l1 1m8 12l2-1m6-7l3 1m3-10l1 2" />
        </pattern>
        <clipPath id="territory-boundary"><polygon points={points} /></clipPath>
        <symbol id="territory-oak" viewBox="0 0 64 64">
          <path className="map-oak-shadow" d="M12 37c-3-12 5-24 14-23 8-10 25-6 28 5 15 6 10 31-5 32-10 11-34 10-37-14Z" />
          <path className="map-oak-crown" d="M10 34c-8-5-5-17 5-19 1-10 13-13 20-7 9-4 21 1 21 11 9 7 5 21-4 24-3 11-18 13-25 6-11 4-20-4-17-15Z" />
          <path className="map-oak-light" d="M10 28c-1-7 5-11 11-11 2-8 11-9 15-4 6-4 14 0 14 6-8 4-14 2-20 8s-13 9-20 1Z" />
          <path className="map-oak-veins" d="M30 46q4-12 4-28m0 15q-7-1-12-7m11 12q8-4 13-10" />
        </symbol>
      </defs>
      <polygon className="map-boundary" points={points} />
      <g clipPath="url(#territory-boundary)">
        <rect width="906" height="876" fill="url(#territory-grain)" />
        <path className="map-contours" d="M10 108Q227 87 402 31M-5 119Q250 97 435 25M181 836Q452 794 886 733M170 821Q520 774 880 718" />
        {oaks.map(([x, y, radius], index) => (
          <use
            key={x}
            href="#territory-oak"
            x={x - radius}
            y={y - radius}
            width={radius * 2}
            height={radius * 2}
            transform={`rotate(${[0, 30, 72, 110][index % 4]} ${x} ${y})`}
          />
        ))}
      </g>
      <g className="map-paths">
        <path d="M2 300L120 264" strokeWidth="20" />
        <path d="M120 264Q225 237 275 265T485 330L634 389" strokeWidth="11" />
      </g>
      <text className="map-grove-label" x="391" y="704" transform="rotate(-9 391 704)">
        Дубовая роща
      </text>
    </g>
  );
}
