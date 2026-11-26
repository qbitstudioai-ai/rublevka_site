import type { MediaAsset } from "@/content/media";
import { siteDefaults } from "./defaults";
import type { SiteData, SiteKey } from "./model";
import { readPublishedSite } from "./store";

export const cmsEnabled = () => process.env.CMS_ENABLED === "true";

export async function publishedSite(): Promise<SiteData> {
  if (!cmsEnabled()) return siteDefaults;
  return readPublishedSite();
}

export async function publicContent<K extends SiteKey>(
  key: K,
): Promise<SiteData[K]> {
  return (await publishedSite())[key];
}

export type MediaCatalog = Readonly<Record<string, MediaAsset>>;

export function catalogFor(items: readonly MediaAsset[]): MediaCatalog {
  return Object.fromEntries(items.map((asset) => [asset.id, asset]));
}

export function catalogAsset(catalog: MediaCatalog, id: string): MediaAsset {
  if (!Object.hasOwn(catalog, id))
    throw new Error("Published media is missing: " + id);
  return catalog[id];
}

export function contactLinks(contact: SiteData["contacts"]) {
  return {
    ...contact,
    tel:
      "tel:+" + contact.phone.replace(/\D/g, "").replace(/^8(?=\d{10}$)/, "7"),
    mapHref: `https://yandex.ru/maps/?pt=${contact.longitude},${contact.latitude}&z=16&l=map`,
  };
}
