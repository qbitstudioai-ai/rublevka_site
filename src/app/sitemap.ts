import type { MetadataRoute } from "next";

import { getSiteUrl, isIndexingEnabled } from "@/server/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!isIndexingEnabled) {
    return [];
  }

  return [
    {
      url: getSiteUrl().toString(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
