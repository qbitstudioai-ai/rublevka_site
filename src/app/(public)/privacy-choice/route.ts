import { NextResponse, type NextRequest } from "next/server";
import { privacyLinks } from "../../../../events-original/lib/shared/privacy-links";
import {
  isPrivacyPreference,
  privacyChoicePath,
  privacyPreferenceCookie,
  privacyPreferenceLifetime,
} from "@/server/privacy-preference";

const headers = {
  "Cache-Control": "private, no-store",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-DNS-Prefetch-Control": "off",
  "X-Robots-Tag": "noindex",
};

function returnPath(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");
  if (!next?.startsWith("/") || !URL.canParse(next, request.nextUrl.origin)) return "/";

  const target = new URL(next, request.nextUrl.origin);
  if (
    target.origin !== request.nextUrl.origin ||
    target.pathname.startsWith("//") ||
    target.pathname.replace(/\/$/, "") === privacyChoicePath
  ) return "/";

  return target.pathname + target.search;
}

export function GET(request: NextRequest) {
  if (isPrivacyPreference(request.cookies.get(privacyPreferenceCookie)?.value)) {
    return new NextResponse(null, { status: 303, headers: { ...headers, Location: returnPath(request) } });
  }

  return new NextResponse(`<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Настройки конфиденциальности — Рублевка</title>
  <style>
    :root {
      --ground: #301a13;
      --paper: #f3d9aa;
      --ink: #472014;
      --accent: #781b12;
      --gold: #efc57e;
      --type: Georgia, serif;
      --space: 1rem;
      --radius: 1rem;
      --tap: 2.75rem;
    }
    * { box-sizing: border-box; }
    body {
      min-height: 100vh;
      min-height: 100dvh;
      margin: 0;
      display: grid;
      place-items: center;
      padding: var(--space);
      color: var(--ink);
      background: var(--ground);
      font: 1rem/1.5 var(--type);
    }
    main {
      width: min(100%, 34rem);
      background: var(--paper);
      border: 3px double var(--accent);
      border-radius: var(--radius);
      outline: 1px solid var(--gold);
      padding: clamp(var(--space), 5vw, calc(2 * var(--space)));
    }
    h1 { margin-top: 0; font-size: clamp(1.6rem, 5vw, 2rem); line-height: 1.15; }
    nav { display: grid; justify-items: start; gap: calc(var(--space) / 2); margin-block: var(--space); }
    a { color: var(--accent); }
    form { display: flex; flex-wrap: wrap; gap: calc(var(--space) / 2); }
    button {
      min-height: var(--tap);
      border: 1px solid var(--accent);
      border-radius: var(--radius);
      background: var(--paper);
      color: var(--ink);
      padding: calc(var(--space) / 2) var(--space);
      font: inherit;
      cursor: pointer;
    }
    button[value="accepted"] { background: var(--accent); color: var(--paper); }
    :focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
  </style>
</head>
<body>
  <main>
    <h1>Настройки конфиденциальности</h1>
    <p>Перед входом ознакомьтесь с документами и выберите, разрешаете ли вы необязательные cookie. Сайт откроется при любом выборе.</p>
    <nav aria-label="Документы">
      ${privacyLinks.map(({ href, label }) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${label} (в новой вкладке)</a>`).join("\n      ")}
    </nav>
    <form method="post">
      <button name="preference" value="accepted">Принять</button>
      <button name="preference" value="declined">Продолжить без необязательных cookie</button>
    </form>
  </main>
</body>
</html>`, { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
}

export async function POST(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return new NextResponse(null, { status: 403, headers });
  }

  const data = await request.formData().catch(() => null);
  const preference = data?.get("preference");
  if (!isPrivacyPreference(preference)) {
    return new NextResponse(null, { status: 400, headers });
  }

  const response = new NextResponse(null, {
    status: 303,
    headers: { ...headers, Location: returnPath(request) },
  });
  response.cookies.set(privacyPreferenceCookie, preference, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: privacyPreferenceLifetime,
  });
  return response;
}
