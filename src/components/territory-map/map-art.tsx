import type { Point } from "@/content/territory-view";
import type { TerritoryObject } from "@/content/territory-map-types";

import { MapBuildings } from "./map-buildings";

export function AtlasOakSprig() {
  return (
    <svg className="territory-sprig" viewBox="0 0 145 178" aria-hidden="true">
      <g className="territory-sprig-leaves">
        <path d="M69 87C55 77 44 84 44 72 28 74 34 62 23 60 17 55 22 50 13 43 7 33 15 28 25 33c11 6 16-5 23 3 7-5 16-1 17 7 13 0 12 12 18 18 2 7-1 15-14 26Z" />
        <path d="M78 70C77 52 67 51 74 39 65 34 72 25 67 21 66 14 72 10 75 3c7 6 12 5 15 12 11-1 15 11 11 16 10 9 4 18-2 19-1 13-11 20-21 20Z" />
        <path d="M76 102C92 86 97 79 109 83c3-8 11-5 17-11 8-5 17 0 16 7-1 6-10 12-9 19-4 7-12 6-13 14-12 12-25 5-44-10Z" />
        <path d="M60 127C45 120 34 133 30 121 19 125 16 115 9 117-2 113 4 102 4 96c10-5 13 2 22-3 8-6 16 0 19 6 14-3 22 13 15 28Z" />
      </g>
      <g className="territory-sprig-veins">
        <path d="M73 83 39 56 20 40m42 35-23-4m20-3 2-17M78 74l10-32-8-28m8 29 9-10M76 101l31-2 26-17m-27 17 8 9M60 125l-20-11-28-12m29 12 1-13" />
        <path d="M41 170c18-21 25-47 33-70l6-23m-9 35c16 7 26 13 28 21m-39 1c-9 1-17 4-23 10" />
      </g>
      <g className="territory-sprig-acorns">
        <path d="M95 130c11-5 18 6 13 16-4 10-18 9-21 0-2-5 2-13 8-16Z" />
        <path d="M28 146c9-9 23 0 18 11-4 10-18 13-22 4-2-5 0-12 4-15Z" />
        <path d="M88 139q6 5 21 1m-85 15q12 1 19-7" />
      </g>
    </svg>
  );
}

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

const lanes = [
  "M142 262C169 226 165 190 209 159S285 144 333 139 419 152 423 170",
  "M337 280C342 236 378 234 409 229",
  "M175 253C158 304 144 370 151 430S148 538 197 556 280 549 316 579 333 663 378 699 438 705 469 724",
  "M317 579C369 584 439 588 481 568S514 530 528 506 581 490 614 463",
  "M474 321C500 354 508 389 553 404S657 391 665 431 672 523 663 561 617 599 609 630 630 659 662 671",
  "M376 697C339 698 313 690 283 708M665 672C688 671 701 653 708 633",
];

export function MapArt({
  boundary,
  objects,
}: {
  boundary: readonly Point[];
  objects: readonly TerritoryObject[];
}) {
  const points = boundary.map((point) => point.join(",")).join(" ");
  return (
    <g aria-hidden="true" className="map-art">
      <defs>
        <linearGradient id="territory-land" x2="80%" y2="90%">
          <stop className="map-land-light" />
          <stop offset=".57" className="map-land-middle" />
          <stop offset="1" className="map-land-shade" />
        </linearGradient>
        <radialGradient id="territory-sun">
          <stop className="map-sun-warm" stopOpacity=".52" />
          <stop offset="1" className="map-sun-warm" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="territory-oak-light" x2="70%" y2="100%">
          <stop className="map-leaf-sun" />
          <stop offset=".62" className="map-leaf-olive" />
          <stop offset="1" className="map-leaf-shade" />
        </linearGradient>
        <linearGradient id="territory-water" x2="100%" y2="100%">
          <stop className="map-pool-light" />
          <stop offset="1" className="map-pool-dark" />
        </linearGradient>
        <linearGradient id="territory-roof-glaze" x2="28%" y2="100%">
          <stop className="map-sun-warm" stopOpacity=".34" />
          <stop offset=".67" className="map-sun-warm" stopOpacity="0" />
          <stop offset="1" className="map-roof-edge" stopOpacity=".34" />
        </linearGradient>
        <pattern id="territory-grain" width="29" height="23" patternUnits="userSpaceOnUse">
          <path d="M3 6l1 1m8 12l2-1m6-7l3 1m3-10l1 2M3 19q2-4 4 0m15-4 1-4 2 3" />
        </pattern>
        <pattern id="territory-shingles" width="8" height="5" patternUnits="userSpaceOnUse">
          <path d="M-2 1q2 3 4 0m0 0q2 3 4 0m0 0q2 3 4 0M0 3.5q2 3 4 0m0 0q2 3 4 0" />
        </pattern>
        <clipPath id="territory-boundary"><polygon points={points} /></clipPath>
        <symbol id="territory-oak" viewBox="0 0 64 64">
          <ellipse className="map-oak-shadow" cx="39" cy="53" rx="23" ry="8" />
          <path className="map-oak-bark" d="M24 55q9-5 6-16l-8-14 12 11 9-15-6 21q-2 7 5 11l-7-1-2 4-2-4Z" />
          <path className="map-oak-crown" d="M7 30C1 25 4 15 12 14 11 6 24 3 29 7c5-8 19-6 20 1 7-1 13 5 11 13 5 5 2 13-4 16 1 9-11 14-18 10-6 6-16 4-20-2-10 1-16-6-11-15Z" />
          <path className="map-oak-lobes" d="M10 20q6-8 12-4-3-8 6-9 7 0 8 7 6-7 12-4 7 4 4 10-9 0-12 4-5-4-12 1-6-8-15 3-5-2-3-8Z" />
          <path className="map-oak-lobes-dark" d="M11 33q6-6 12 2 7-6 13 1 7-8 17-4-2 10-14 12-8 7-17-2-7 3-11-9Z" />
          <path className="map-oak-veins" d="M9 25q5-5 9-3m3-10q7-4 11 0m5 5q7-6 12-3M18 35q5-5 9-2m10-2q6-6 12-5m-21-5 1-2m13 18 2-3m-21-10 2-2" />
          <path className="map-oak-bark-light" d="M32 42q2 8-1 11" />
        </symbol>
      </defs>
      <polygon className="map-boundary-shadow" points={points} transform="translate(3 11)" />
      <polygon className="map-boundary-edge" points={points} transform="translate(0 5)" />
      <polygon className="map-boundary" points={points} />
      <g clipPath="url(#territory-boundary)">
        <ellipse cx="216" cy="228" rx="400" ry="375" fill="url(#territory-sun)" />
        <ellipse cx="532" cy="583" rx="300" ry="277" fill="url(#territory-sun)" />
        <rect width="906" height="876" fill="url(#territory-grain)" />
        <path className="map-contours" d="M10 108Q227 87 402 31M-5 119Q250 97 435 25M181 836Q452 794 886 733M170 821Q520 774 880 718M37 173Q240 46 465 96T621 98M307 548Q384 605 485 567T663 574" />
        <g className="map-lanes">
          {lanes.map((lane) => <path key={lane} d={lane} />)}
        </g>
      </g>
      <g className="map-paths">
        <path d="M2 300L120 264Q225 237 275 265T485 330L634 389" />
        <path className="map-path-grain" d="M2 300L120 264Q225 237 275 265T485 330L634 389" />
      </g>
      <g clipPath="url(#territory-boundary)">
        {oaks.toSorted((a, b) => a[1] - b[1]).map(([x, y, radius], index) => (
          <use
            key={x}
            href="#territory-oak"
            x={x - radius}
            y={y - radius * 1.17}
            width={radius * 2}
            height={radius * 2}
            transform={`rotate(${[-11, -4, 9, 14][index % 4]} ${x} ${y})`}
          />
        ))}
      </g>
      <MapBuildings objects={objects} />
      <text className="map-grove-label" x="391" y="704" transform="rotate(-9 391 704)">
        Дубовая роща
      </text>
    </g>
  );
}
