#!/usr/bin/env node
/**
 * Генерирует изображения пергамента для свитка «Подробнее» (public/parchment/):
 *   rolled.webp — свёрнутый свиток со шнурком (кнопка в шапке);
 *   roll.webp   — валик развёрнутого свитка (сверху и снизу);
 *   sheet.webp  — полотно: бесшовное по вертикали, с рваными боковыми краями,
 *                 поэтому свиток растягивается под любой объём текста.
 *
 * Всё рисуется процедурно (SVG-фильтры: фрактальный шум, карта смещения) и рендерится sharp,
 * поэтому у изображений прозрачный фон и нет вопросов с лицензией на фото.
 * Запуск: node scripts/generate-parchment.mjs [каталог-для-превью]
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OUT = path.join(process.cwd(), "public", "parchment");
const PREVIEW = process.argv[2] ?? null;

// Цвета пергамента: светлая середина, тёплые пятна, обожжённые края.
const PAPER_LIGHT = "#f4e3bb";
const PAPER = "#ead2a0";
const PAPER_DARK = "#d7b277";

/**
 * Текстура бумаги поверх формы in="shape": мягкие крупные пятна, лёгкая пятнистость, волокна и зерно.
 * Контраст намеренно низкий — как у настоящего пергамента, а не «камуфляж».
 */
const paperTexture = (seed, { burn = 18, burnAlpha = 1.6 } = {}) => `
  <feTurbulence type="fractalNoise" baseFrequency="0.0032 0.0045" numOctaves="3" seed="${seed}" result="nBig"/>
  <feColorMatrix in="nBig" type="matrix" result="stains" values="0 0 0 0 0.72  0 0 0 0 0.52  0 0 0 0 0.27  1.7 0 0 0 -0.88"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves="3" seed="${seed + 7}" result="nMid"/>
  <feColorMatrix in="nMid" type="matrix" result="mottle" values="0 0 0 0 0.64  0 0 0 0 0.45  0 0 0 0 0.21  0.7 0 0 0 -0.37"/>
  <feColorMatrix in="nMid" type="matrix" result="glow" values="0 0 0 0 1  0 0 0 0 0.97  0 0 0 0 0.88  0 1.1 0 0 -0.56"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.008 0.11" numOctaves="2" seed="${seed + 13}" result="nFib"/>
  <feColorMatrix in="nFib" type="matrix" result="fibers" values="0 0 0 0 0.6  0 0 0 0 0.42  0 0 0 0 0.2  0.3 0 0 0 -0.17"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${seed + 21}" result="nGrain"/>
  <feColorMatrix in="nGrain" type="matrix" result="grain" values="0 0 0 0 0.5  0 0 0 0 0.35  0 0 0 0 0.16  0.42 0 0 0 -0.18"/>
  <feMerge result="painted">
    <feMergeNode in="shape"/>
    <feMergeNode in="stains"/>
    <feMergeNode in="glow"/>
    <feMergeNode in="mottle"/>
    <feMergeNode in="fibers"/>
    <feMergeNode in="grain"/>
  </feMerge>
  <feComposite in="painted" in2="shape" operator="in" result="textured"/>
  ${
    burn
      ? `
  <feGaussianBlur in="shape" stdDeviation="${burn} 0" result="soft"/>
  <feComposite in="shape" in2="soft" operator="arithmetic" k2="1" k3="-1" result="edgeRaw"/>
  <feComposite in="edgeRaw" in2="nMid" operator="arithmetic" k1="${burnAlpha}" k2="0.9" result="edge"/>
  <feFlood flood-color="#9a6a32" result="burnColor"/>
  <feComposite in="burnColor" in2="edge" operator="in" result="burn"/>
  <feGaussianBlur in="shape" stdDeviation="1.6 0" result="softRim"/>
  <feComposite in="shape" in2="softRim" operator="arithmetic" k2="1.8" k3="-1.8" result="rimMask"/>
  <feFlood flood-color="#6a4116" result="rimColor"/>
  <feComposite in="rimColor" in2="rimMask" operator="in" result="rim"/>
  <feMerge result="burnt"><feMergeNode in="textured"/><feMergeNode in="burn"/><feMergeNode in="rim"/></feMerge>
  <feComposite in="burnt" in2="shape" operator="in"/>`
      : ""
  }`;

/** Рваный край: горизонтальное смещение формы шумом — плавные волны и мелкие «зазубрины». */
const tornEdge = (seed, scale) => `
  <feTurbulence type="fractalNoise" baseFrequency="0.006 0.02" numOctaves="4" seed="${seed}" result="nTear"/>
  <feColorMatrix in="nTear" type="matrix" result="tearMap" values="1 0 0 0 0  0 0 0 0 0.5  0 0 0 0 0  0 0 0 0 1"/>
  <feDisplacementMap in="SourceGraphic" in2="tearMap" scale="${scale}" xChannelSelector="R" yChannelSelector="G" result="torn"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.05 0.16" numOctaves="3" seed="${seed + 3}" result="nFray"/>
  <feColorMatrix in="nFray" type="matrix" result="frayMap" values="1 0 0 0 0  0 0 0 0 0.5  0 0 0 0 0  0 0 0 0 1"/>
  <feDisplacementMap in="torn" in2="frayMap" scale="9" xChannelSelector="R" yChannelSelector="G" result="shape"/>`;

/**
 * Полотно: тайл W×H с рваными краями слева и справа. Бесшовность по вертикали даёт render():
 * тайл склеивается со своей зеркальной копией, и стыки совпадают по построению.
 */
function sheetSvg(W = 1000, H = 900) {
  const inset = 26;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="tone" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="${PAPER_DARK}"/>
      <stop offset="0.12" stop-color="${PAPER}"/>
      <stop offset="0.5" stop-color="${PAPER_LIGHT}"/>
      <stop offset="0.88" stop-color="${PAPER}"/>
      <stop offset="1" stop-color="${PAPER_DARK}"/>
    </linearGradient>
    <filter id="paper" x="0" y="0" width="${W}" height="${H}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      ${tornEdge(11, 22)}
      ${paperTexture(5)}
    </filter>
  </defs>
  <rect x="${inset}" y="-40" width="${W - inset * 2}" height="${H + 80}" fill="url(#tone)" filter="url(#paper)"/>
  <!-- render() срезает по 4 px сверху и снизу: тайл рисуется с запасом. -->

</svg>`;
}

/** Цилиндр из свёрнутой бумаги: тело с объёмной светотенью и торцы со спиралью слоёв. */
function cylinder({ x, y, w, d, seed, id }) {
  const r = d / 2;
  const cy = y + r;
  const rx = Math.round(d * 0.16);
  // Спираль торца: несколько витков от края к центру.
  const spiral = (cx, dir) => {
    let p = "";
    const turns = 4.2;
    const steps = 90;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = t * turns * Math.PI * 2;
      const k = 1 - t * 0.82;
      const px = cx + dir * Math.cos(a) * rx * k;
      const py = cy + Math.sin(a) * (r - 3) * k;
      p += `${i ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`;
    }
    return p;
  };
  return `
  <defs>
    <linearGradient id="${id}-shade" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#9c7134"/>
      <stop offset="0.07" stop-color="#cfa865"/>
      <stop offset="0.22" stop-color="#f1dcac"/>
      <stop offset="0.34" stop-color="#fbeccb"/>
      <stop offset="0.5" stop-color="#ecd29b"/>
      <stop offset="0.74" stop-color="#d5b073"/>
      <stop offset="0.9" stop-color="#ad8243"/>
      <stop offset="1" stop-color="#77501f"/>
    </linearGradient>
    <linearGradient id="${id}-end" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#b58a4c"/>
      <stop offset="0.45" stop-color="#e2c38c"/>
      <stop offset="1" stop-color="#9a6d33"/>
    </linearGradient>
    <filter id="${id}-skin" x="${x - 30}" y="${y - 30}" width="${w + 60}" height="${d + 60}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.05 0.3" numOctaves="2" seed="${seed}" result="nWob"/>
      <feColorMatrix in="nWob" type="matrix" result="wobMap" values="1 0 0 0 0  0 0 0 0 0.5  0 0 0 0 0  0 0 0 0 1"/>
      <feDisplacementMap in="SourceGraphic" in2="wobMap" scale="5" xChannelSelector="R" yChannelSelector="G" result="shape"/>
      ${paperTexture(seed + 2, { burn: 0 })}
    </filter>
    <filter id="${id}-ends" x="${x - 40}" y="${y - 30}" width="${w + 80}" height="${d + 60}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="3" seed="${seed + 5}" result="nEnd"/>
      <feDisplacementMap in="SourceGraphic" in2="nEnd" scale="6" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
  </defs>
  <rect x="${x}" y="${y}" width="${w}" height="${d}" rx="${rx}" ry="${r}" fill="url(#${id}-shade)" filter="url(#${id}-skin)"/>
  <g filter="url(#${id}-ends)">
    <ellipse cx="${x + rx}" cy="${cy}" rx="${rx}" ry="${r - 1}" fill="url(#${id}-end)"/>
    <path d="${spiral(x + rx, -1)}" fill="none" stroke="#8d6230" stroke-width="1.5" stroke-opacity="0.55"/>
    <ellipse cx="${x + rx}" cy="${cy}" rx="${rx}" ry="${r - 1}" fill="none" stroke="#6e4719" stroke-width="2.2" stroke-opacity="0.65"/>
    <ellipse cx="${x + w - rx}" cy="${cy}" rx="${rx}" ry="${r - 1}" fill="url(#${id}-end)"/>
    <path d="${spiral(x + w - rx, 1)}" fill="none" stroke="#8d6230" stroke-width="1.5" stroke-opacity="0.55"/>
    <ellipse cx="${x + w - rx}" cy="${cy}" rx="${rx}" ry="${r - 1}" fill="none" stroke="#6e4719" stroke-width="2.2" stroke-opacity="0.65"/>
  </g>`;
}

/** Валик развёрнутого свитка. Полотно уходит под него, поэтому валик чуть шире полотна. */
function rollSvg(W = 1300, H = 170) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <filter id="drop" x="-5%" y="-30%" width="110%" height="180%"><feGaussianBlur stdDeviation="7"/></filter>
  </defs>
  <ellipse cx="${W / 2}" cy="${H - 34}" rx="${W / 2 - 60}" ry="16" fill="#3d2410" opacity="0.32" filter="url(#drop)"/>
  ${cylinder({ x: 22, y: 26, w: W - 44, d: 112, seed: 41, id: "roll" })}
</svg>`;
}

/**
 * Кожаный шнурок: две обмотки вокруг свитка (затенены сверху и снизу — повторяют изгиб цилиндра),
 * узел спереди и два свободных конца.
 */
function cord(cx, y, d) {
  const top = y - 3;
  const bottom = y + d + 3;
  const knotY = y + d * 0.48;
  const band = (x0, lean) =>
    `M${x0} ${top} C ${x0 + lean} ${top + d * 0.35}, ${x0 + lean} ${bottom - d * 0.35}, ${x0 + lean * 0.4} ${bottom} ` +
    `L ${x0 + lean * 0.4 + 15} ${bottom} C ${x0 + lean + 15} ${bottom - d * 0.35}, ${x0 + lean + 15} ${top + d * 0.35}, ${x0 + 15} ${top} Z`;
  const bands = `<path d="${band(cx - 20, 5)}"/><path d="${band(cx + 6, 6)}"/>`;
  const tails =
    // Длинный конец свисает вниз-влево за пределы свитка, короткий — вправо.
    `<path d="M${cx + 2} ${knotY} C ${cx - 6} ${knotY + 40}, ${cx - 22} ${bottom + 30}, ${cx - 44} ${bottom + 74} ` +
    `L ${cx - 31} ${bottom + 79} C ${cx - 12} ${bottom + 36}, ${cx + 6} ${knotY + 44}, ${cx + 15} ${knotY + 2} Z"/>` +
    `<path d="M${cx + 8} ${knotY - 2} C ${cx + 30} ${knotY + 6}, ${cx + 46} ${knotY + 24}, ${cx + 58} ${knotY + 44} ` +
    `L ${cx + 47} ${knotY + 50} C ${cx + 38} ${knotY + 32}, ${cx + 24} ${knotY + 16}, ${cx + 6} ${knotY + 10} Z"/>`;
  return `
  <defs>
    <linearGradient id="cordCurve" x1="0" x2="0" y1="${top}" y2="${bottom}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#000" stop-opacity="0.55"/>
      <stop offset="0.3" stop-color="#000" stop-opacity="0"/>
      <stop offset="0.7" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.6"/>
    </linearGradient>
    <radialGradient id="knot" cx="0.4" cy="0.35" r="0.7">
      <stop offset="0" stop-color="#a8673a"/>
      <stop offset="1" stop-color="#4e260f"/>
    </radialGradient>
    <filter id="cordShadow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5"/><feOffset dx="2" dy="3"/></filter>
  </defs>
  <g fill="#2a1406" opacity="0.4" filter="url(#cordShadow)">${bands}${tails}</g>
  <g filter="url(#leatherTex)">
    <g fill="url(#leather)">${bands}${tails}</g>
    <g fill="url(#cordCurve)">${bands}</g>
    <ellipse cx="${cx + 3}" cy="${knotY}" rx="17" ry="12" fill="url(#knot)"/>
  </g>`;
}

/** Свёрнутый свиток: цилиндр, свободный рваный край верхнего слоя и кожаный шнурок. */
function rolledSvg(W = 900, H = 250) {
  const x = 46;
  const y = 74;
  const w = W - 92;
  const d = 96;
  // Свободный край внешнего слоя: приподнят у торцов, ложится на свиток к середине.
  const flapTop = "M60 98 C 120 58, 180 66, 250 82 S 400 104, 470 100 S 640 92, 700 78 S 800 56, 846 70";
  const flap = `${flapTop} L 850 112 L 56 112 Z`;
  const cordX = 238;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <filter id="soft" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="9"/></filter>
    <linearGradient id="flapShade" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#f6e6bf"/>
      <stop offset="0.6" stop-color="#ecd29e"/>
      <stop offset="1" stop-color="#d8b67b"/>
    </linearGradient>
    <filter id="flapPaper" x="0" y="0" width="${W}" height="${H}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.06 0.04" numOctaves="5" seed="17" result="nTear"/>
      <feDisplacementMap in="SourceGraphic" in2="nTear" scale="12" xChannelSelector="G" yChannelSelector="R" result="shape"/>
      ${paperTexture(23, { burn: 0 })}
    </filter>
    <filter id="flapBurn" x="0" y="0" width="${W}" height="${H}" filterUnits="userSpaceOnUse">
      <feTurbulence type="fractalNoise" baseFrequency="0.06 0.04" numOctaves="5" seed="17" result="nTear"/>
      <feDisplacementMap in="SourceGraphic" in2="nTear" scale="12" xChannelSelector="G" yChannelSelector="R"/>
      <feGaussianBlur stdDeviation="1.2"/>
    </filter>
    <filter id="flapShadow" x="0" y="0" width="${W}" height="${H}" filterUnits="userSpaceOnUse">
      <feTurbulence type="fractalNoise" baseFrequency="0.06 0.04" numOctaves="5" seed="17" result="nTear"/>
      <feDisplacementMap in="SourceGraphic" in2="nTear" scale="12" xChannelSelector="G" yChannelSelector="R"/>
      <feGaussianBlur stdDeviation="3.5"/>
      <feOffset dy="5"/>
    </filter>
    <linearGradient id="leather" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#5a2e14"/>
      <stop offset="0.45" stop-color="#9a5a2c"/>
      <stop offset="1" stop-color="#5f3016"/>
    </linearGradient>
    <filter id="leatherTex" x="0" y="0" width="${W}" height="${H}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.25 0.9" numOctaves="2" seed="31" result="n"/>
      <feColorMatrix in="n" type="matrix" result="spots" values="0 0 0 0 0.25  0 0 0 0 0.12  0 0 0 0 0.04  1.4 0 0 0 -0.55"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="33" result="nw"/>
      <feDisplacementMap in="SourceGraphic" in2="nw" scale="3" xChannelSelector="R" yChannelSelector="G" result="shape"/>
      <feMerge result="m"><feMergeNode in="shape"/><feMergeNode in="spots"/></feMerge>
      <feComposite in="m" in2="shape" operator="in"/>
    </filter>
  </defs>
  <ellipse cx="${W / 2}" cy="${y + d + 8}" rx="${w / 2 - 10}" ry="13" fill="#3d2410" opacity="0.38" filter="url(#soft)"/>
  ${cylinder({ x, y, w, d, seed: 61, id: "rolled" })}
  <path d="${flap}" fill="#3d2410" opacity="0.32" filter="url(#flapShadow)"/>
  <path d="${flap}" fill="url(#flapShade)" filter="url(#flapPaper)"/>
  <path d="${flapTop}" fill="none" stroke="#8a5a26" stroke-width="2.4" stroke-opacity="0.7" filter="url(#flapBurn)"/>
  ${cord(cordX, y, d)}
</svg>`;
}

async function render(svg, file, preview, { mirrorTile = false } = {}) {
  let png = await sharp(Buffer.from(svg)).png().toBuffer();
  if (mirrorTile) {
    // Тайл + его зеркальная копия: верх и низ склейки совпадают, повтор по вертикали без шва.
    // Крайние ряды рендера чуть темнее (сглаживание границы фильтра) — срезаем их до склейки.
    const meta = await sharp(png).metadata();
    png = await sharp(png).extract({ left: 0, top: 4, width: meta.width, height: meta.height - 8 }).png().toBuffer();
    const { width, height } = await sharp(png).metadata();
    const flipped = await sharp(png).flip().toBuffer();
    png = await sharp({ create: { width, height: height * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([
        { input: png, top: 0, left: 0 },
        { input: flipped, top: height, left: 0 },
      ])
      .png()
      .toBuffer();
  }
  if (preview) fs.writeFileSync(path.join(preview, file.replace(/\.webp$/, ".png")), png);
  await sharp(png).webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(path.join(OUT, file));
}

fs.mkdirSync(OUT, { recursive: true });
if (PREVIEW) fs.mkdirSync(PREVIEW, { recursive: true });
await render(sheetSvg(), "sheet.webp", PREVIEW, { mirrorTile: true });
await render(rollSvg(), "roll.webp", PREVIEW);
await render(rolledSvg(), "rolled.webp", PREVIEW);
for (const file of ["sheet.webp", "roll.webp", "rolled.webp"]) {
  const { width, height, size } = await sharp(path.join(OUT, file)).metadata().then(async (m) => ({ ...m, size: fs.statSync(path.join(OUT, file)).size }));
  console.log(`${file}: ${width}×${height}, ${Math.round(size / 1024)} КБ`);
}
