import type { Metadata } from "next";

import { HomeStory } from "@/components/home/home-story";
import { getSiteUrl } from "@/server/site-url";

export const metadata: Metadata = {
  title: "Загородный комплекс в дубовом лесу",
  description:
    "Загородный отдых в дубовой роще под Волгоградом. Дома, беседки, два банкетных зала и баня в Краснослободске — фотографии и контакты «Рублевки».",
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
