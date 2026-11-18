import type { Metadata } from "next";

import { HomeStory } from "@/components/home/home-story";
import { getSiteUrl } from "@/server/site-url";

export const metadata: Metadata = {
  title: "Загородный комплекс в дубовом лесу",
  description:
    "Интерактивный прототип загородного комплекса «Рублевка»: домики, беседки, банкетные залы и банный комплекс.",
  alternates: {
    canonical: "/",
  },
};

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
