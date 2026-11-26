import { NextResponse, type NextRequest } from "next/server";
import { privacyLinks } from "../events-original/lib/shared/privacy-links";
import {
  isPrivacyPreference,
  privacyChoicePath,
  privacyPreferenceCookie,
} from "./server/privacy-preference";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/meropriyatiya/api/internal/"))
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });

  if (isPrivacyPreference(request.cookies.get(privacyPreferenceCookie)?.value)) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  if (privacyLinks.some(({ href }) => href === pathname)) {
    const response = NextResponse.next();
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-DNS-Prefetch-Control", "off");
    response.headers.set("Content-Security-Policy", [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; "));
    return response;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new NextResponse(null, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const destination = new URL(privacyChoicePath, request.url);
  destination.searchParams.set("next", pathname + search);
  const response = NextResponse.redirect(destination, 307);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export const config = {
  matcher: [
    "/meropriyatiya/api/internal/:path*",
    "/((?!admin(?:/|$)|api(?:/|$)|_next(?:/|$)|art(?:/|$)|images(?:/|$)|cms-media(?:/|$)|privacy-choice(?:/|$)|meropriyatiya/(?:admin|api|_next|media|art|brand|catalog|fonts|mock|parchment)(?:/|$)|.*\\.[^/]+$).*)",
  ],
};
