import type { Metadata } from "next";

import { GuideHeader } from "@/components/guide/guide-page";
import { MapArt } from "@/components/territory-map/map-art";
import { MapBuildings } from "@/components/territory-map/map-buildings";
import { TerritoryMap } from "@/components/territory-map/territory-map";
import { territoryBoundary, territoryObjects } from "@/content/territory-map";
import { getSiteUrl, isIndexingEnabled } from "@/server/site-url";

import "../[section]/guide.css";
import "./territory.css";

const title = "Карта комплекса";
const description = "Интерактивная карта Рублевки. Найдите дома, беседки, банкетные залы, бассейны и другие объекты на территории комплекса.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/karta" },
  robots: { index: isIndexingEnabled, follow: isIndexingEnabled },
};

export default function MapPage() {
  const url = new URL("/karta", getSiteUrl()).href;
  const schema = {
    "@context": "https://schema.org",
    "@type": "Map",
    name: `${title} «Рублевка»`,
    description,
    inLanguage: "ru-RU",
    url,
  };

  return (
    <div className="guest-guide territory-page">
      <a className="guide-skip" href="#territory-content">К карте</a>
      <GuideHeader id="karta" />
      <main className="territory-frame" id="territory-content">
        <TerritoryMap objects={territoryObjects} intro={
          <header className="territory-intro">
            <h1>{title}</h1>
            <p>Дома и места отдыха в дубовой роще</p>
          </header>
        }>
          <MapArt boundary={territoryBoundary} />
          <MapBuildings objects={territoryObjects} />
        </TerritoryMap>
      </main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }}
      />
    </div>
  );
}
