import type { MetadataRoute } from "next";

import { getSiteUrl, isIndexingEnabled } from "@/server/site-url";
import { publicContent } from "@/server/cms/public";
import { sectionIds } from "@/content/sections";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isIndexingEnabled) {
    return [];
  }

  const [book, ...pages] = await Promise.all([
    publicContent("book"),
    ...sectionIds.map((id) => publicContent(id)),
  ]);
  return [
    ...(book.indexable
      ? [
          {
            url: getSiteUrl().toString(),
            changeFrequency: "weekly" as const,
            priority: 1,
          },
        ]
      : []),
    ...sectionIds
      .filter((_, index) => pages[index].indexable)
      .map((id) => ({ url: new URL("/" + id, getSiteUrl()).href })),
  ];
}
