import type { MetadataRoute } from "next";

import { getSiteUrl, isIndexingEnabled } from "@/server/site-url";
import { sectionIds } from "@/content/sections";

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
    ...sectionIds.map((id) => ({ url: new URL("/" + id, getSiteUrl()).href })),
  ];
}
