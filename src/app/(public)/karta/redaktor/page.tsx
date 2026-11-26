import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TerritoryEditor } from "@/components/territory-map/territory-editor";
import { parseTerritoryLayout } from "@/content/territory-layout";
import layoutSource from "@/content/territory-layout.json";
import { territoryBoundary, territoryObjects } from "@/content/territory-map";

import "../../[section]/guide.css";
import "../territory.css";
import "./editor.css";

export const metadata: Metadata = {
  title: "Редактор карты комплекса",
  robots: { index: false, follow: false },
};

export default function MapEditorPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <TerritoryEditor
      objects={territoryObjects}
      boundary={territoryBoundary}
      initialLayout={parseTerritoryLayout(layoutSource)}
    />
  );
}
