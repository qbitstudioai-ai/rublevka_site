const front = "M30 56 58 27 91 55 106 56 130 33 157 58 157 136 30 136Z";
const side = "M9 58 30 56 30 136 9 119Z";
const leftRoof = "M5 52 39 12 60 25 28 62Z";
const rightRoof = "M101 53 109 17 132 30 107 58Z";

export function CarvedInnDefinitions() {
  return (
    <>
      <linearGradient id="territory-inn-timber" x1="0" y1="0" x2="38%" y2="100%">
        <stop stopColor="var(--inn-timber-sun)" />
        <stop offset=".48" stopColor="var(--inn-timber)" />
        <stop offset="1" stopColor="var(--inn-timber-shade)" />
      </linearGradient>
      <linearGradient id="territory-inn-roof" x1="25%" y1="0" x2="85%" y2="100%">
        <stop stopColor="var(--inn-roof-sun)" />
        <stop offset="1" stopColor="var(--inn-roof-shade)" />
      </linearGradient>
      <pattern id="territory-inn-log-lines" width="17" height="5.3" patternUnits="userSpaceOnUse">
        <path d="M0 4.7h17" className="inn-log-joint" />
        <path d="M1 1.25q6-.55 12 0m-9 1.5 10-.45" className="inn-log-grain" />
      </pattern>
      <pattern id="territory-inn-metal-seams" width="5.5" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
        <path d="M1 0v6M1.7 0v6" className="inn-metal-seam" />
      </pattern>
      <g id="territory-inn-window">
        <path className="inn-trim" d="M-2 5 1 3Q10-6 20 3l3 2v24l-3 2v2l-3-2H3l-3 2v-2l-2-2Z" />
        <path className="inn-glass" d="M2 7h17v20H2Z" />
        <path className="inn-glint" d="m4 9 6 0-6 9Zm9 7 4-4v5l-4 7Z" />
        <path className="inn-mullion" d="M10 7v20m0-12h9" />
        <path className="inn-cutwork" d="M1 5q2 2 3 0t3 0 3 0 3 0 3 0 3 0M0 9v16m21-16v16M1 29q2-1.8 3 0t3 0 3 0 3 0 3 0 3 0" />
      </g>
      <symbol id="territory-carved-inn" viewBox="0 0 166 148">
        <path className="inn-shadow" d="M9 119 157 131 165 141 101 148 27 145 7 131Z" />
        <path className="inn-plinth" d="M9 115 30 129 158 129 159 138 30 141 9 123Z" />
        <path className="inn-side" d={side} />
        <path d={side} fill="url(#territory-inn-log-lines)" />
        <path className="inn-front" d={front} />
        <path d={front} fill="url(#territory-inn-log-lines)" />
        <path className="inn-side-grain" d="m10 65 20 9m-20-1 20 9m-20-1 20 9m-20-1 20 9m-20-1 20 9m-20-1 20 9m-20-1 20 9m-20-1 20 9" />

        <use href="#territory-inn-window" transform="translate(14 66) skewY(23) scale(.47 .65)" />
        <use href="#territory-inn-window" transform="translate(14 100) skewY(23) scale(.47 .63)" />
        <use href="#territory-inn-window" transform="translate(46 44) scale(.98 1.04)" />
        <use href="#territory-inn-window" transform="translate(47 95) scale(.98 1)" />
        <use href="#territory-inn-window" transform="translate(91 59) scale(.73 .94)" />
        <use href="#territory-inn-window" transform="translate(120 52) scale(.89 1)" />
        <use href="#territory-inn-window" transform="translate(124 96) scale(.86 .96)" />
        <path className="inn-corner-ends" d="M30 61v76m54-79v40m26-38v36m47-33v72" />

        <path className="inn-valley" d="M32 16 55 11 93 33 113 37 112 57 90 55 57 31Z" />
        <path className="inn-roof" d={leftRoof} />
        <path d={leftRoof} fill="url(#territory-inn-metal-seams)" />
        <path className="inn-roof" d={rightRoof} />
        <path d={rightRoof} fill="url(#territory-inn-metal-seams)" />
        <path className="inn-roof" d="M109 17 137 34 163 59 133 31Z" />
        <path className="inn-roof-ridge" d="m39 12 21 13m49-8 23 13" />
        <path className="inn-fascia-shadow" d="M6 55 28 62 60 26 91 56 107 59 132 32 160 60" />
        <path className="inn-fascia" d="M6 54 28 60 60 24 91 54 107 57 132 30 160 58" />
        <path className="inn-fascia-cutwork" d="M7 54 28 60 60 24 91 54 107 57 132 30 159 58" />

        <path className="inn-door-frame" d="M92 112h17v24H92Z" />
        <path className="inn-door" d="M94 114h13v22H94Z" />
        <path className="inn-door-detail" d="M97 116v17m7-17v17m-6-14h6m-6 6h6m0-1h1" />
        <path className="inn-steps" d="M87 135h25l4 4H84Z" />
        <path className="inn-steps" d="M84 139h32l3 3H82Z" />
        <path className="inn-porch-posts" d="M83 111v23m30-23v23" />
        <path className="inn-porch-shadow" d="M75 115 98 98 121 114 115 116 98 103 81 117Z" />
        <path className="inn-roof" d="M72 112 81 105 100 95 122 113 118 114 99 101 77 116Z" />
        <path className="inn-porch-trim" d="m76 115 24-15 20 14" />
      </symbol>
    </>
  );
}

export function CarvedInn({ width, depth }: { width: number; depth: number }) {
  const scale = (width * 1.08) / 166;
  return (
    <use
      href="#territory-carved-inn"
      x={-(width * 0.04)}
      y={depth - 140 * scale}
      width={166 * scale}
      height={148 * scale}
    />
  );
}
