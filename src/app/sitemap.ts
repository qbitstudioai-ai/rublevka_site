import type { MetadataRoute } from "next";

import { getSiteUrl, isIndexingEnabled } from "@/server/site-url";
import { publicContent } from "@/server/cms/public";
import { sectionIds } from "@/content/sections";
import { privacyLinks } from "../../events-original/lib/shared/privacy-links";

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
    { url: new URL("/karta", getSiteUrl()).href },
    ...privacyLinks.map(({ href }) => ({ url: new URL(href, getSiteUrl()).href })),
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
