import type { MetadataRoute } from "next";

import { getSiteUrl, isIndexingEnabled } from "@/server/site-url";
import { sectionIds } from "@/content/sections";

import { listPublishedEvents } from "@/server/events/public";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isIndexingEnabled) {
    return [];
  }

  return [
    {
      url: getSiteUrl().toString(),
      changeFrequency: "weekly",
      priority: 1,
    },
    { url: new URL("/meropriyatiya", getSiteUrl()).href },
    ...(await listPublishedEvents()).map(({ slug }) => ({
      url: new URL("/meropriyatiya/" + slug, getSiteUrl()).href,
    })),
    ...sectionIds.map((id) => ({ url: new URL("/" + id, getSiteUrl()).href })),
  ];
}
