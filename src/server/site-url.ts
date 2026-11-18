const DEFAULT_SITE_URL = "https://rublevka34.com";

export function getSiteUrl(): URL {
  const configuredUrl = process.env.SITE_URL?.trim();

  if (!configuredUrl) {
    return new URL(DEFAULT_SITE_URL);
  }

  try {
    return new URL(configuredUrl);
  } catch {
    throw new Error("SITE_URL must be an absolute URL, for example https://example.com");
  }
}
