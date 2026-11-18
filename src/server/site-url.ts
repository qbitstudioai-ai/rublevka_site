const DEFAULT_SITE_URL = "http://localhost:3000";

export const isIndexingEnabled = process.env.SEO_INDEXING_ENABLED === "true";

export function getSiteUrl(): URL {
  const configuredUrl = process.env.SITE_URL?.trim();

  if (!configuredUrl) {
    if (isIndexingEnabled) {
      throw new Error("SITE_URL is required when SEO_INDEXING_ENABLED=true");
    }

    return new URL(DEFAULT_SITE_URL);
  }

  let siteUrl: URL;

  try {
    siteUrl = new URL(configuredUrl);
  } catch {
    throw new Error("SITE_URL must be an absolute URL, for example https://example.com");
  }

  if (isIndexingEnabled && siteUrl.protocol !== "https:") {
    throw new Error("SITE_URL must use HTTPS when SEO_INDEXING_ENABLED=true");
  }

  if (isIndexingEnabled) {
    const hostname = siteUrl.hostname.toLowerCase().replace(/\.$/, "");
    const isIpLiteral = hostname.startsWith("[") || /^\d+(?:\.\d+){3}$/.test(hostname);
    const isLocalHostname =
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      !hostname.includes(".");
    const isOriginOnly =
      siteUrl.username === "" &&
      siteUrl.password === "" &&
      siteUrl.pathname === "/" &&
      siteUrl.search === "" &&
      siteUrl.hash === "";

    if (isIpLiteral || isLocalHostname || !isOriginOnly) {
      throw new Error(
        "SITE_URL must be a public HTTPS origin without credentials, path, query, or hash when indexing is enabled",
      );
    }
  }

  return siteUrl;
}
