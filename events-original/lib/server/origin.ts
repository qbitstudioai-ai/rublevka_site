import { headers } from "next/headers";

/** Публичный адрес сайта для ссылок в админпанели: APP_URL или заголовки запроса. */
export async function getOrigin() {
  const configured = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured + "/meropriyatiya";
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const proto = requestHeaders.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? "http" : "https");
  return `${proto}://${host}/meropriyatiya`;
}
