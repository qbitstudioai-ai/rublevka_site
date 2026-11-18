import type { Metadata } from "next";

import { DevelopmentNotice } from "@/components/ui/development-notice";
import { getSiteUrl } from "@/server/site-url";

export const metadata: Metadata = {
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
    <main className="development-page">
      <DevelopmentNotice />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
    </main>
  );
}
