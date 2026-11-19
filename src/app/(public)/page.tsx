import type { Metadata } from "next";

import { HomeStory } from "@/components/home/home-story";
import { publicContent } from "@/server/cms/public";
import { getSiteUrl, isIndexingEnabled } from "@/server/site-url";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const book = await publicContent("book");
  return {
    title: book.title,
    description: book.description,
    alternates: { canonical: "/" },
    robots: {
      index: isIndexingEnabled && book.indexable,
      follow: isIndexingEnabled,
    },
  };
}

export default function HomePage() {
  const siteUrl = getSiteUrl();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Рублевка",
    url: siteUrl.toString(),
    inLanguage: "ru-RU",
  } as const;

  return (
    <>
      <HomeStory />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}
