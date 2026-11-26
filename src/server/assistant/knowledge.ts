import { z } from "zod";
import { getSiteUrl } from "../site-url";
import { cmsEnabled, publishedSite, contactLinks } from "../cms/public";
import type { SiteData } from "../cms/model";
import { ApiError } from "./security";
import { objectId } from "./booking";

export const serviceId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/);
export const serviceSections = ["banya", "besedki", "banketnye-zaly", "uslugi"] as const;

export function siteLink(path: string) { return new URL(path, getSiteUrl()).href; }
function picture(site: SiteData, id?: string) {
  const image = site.media.items.find((asset) => asset.id === id);
  return image ? siteLink(image.src) : null;
}

export function accommodations(site: SiteData) {
  return site.prozhivanie.items.filter((item) => item.visible).map((item) => {
    // Legacy CMS records expose capacity as a public label.
    const capacity = /^(\d+) гост(?:ь|я|ей)(?:$|\s*·)/u.exec(item.detail ?? "");
    return {
      id: item.id, title: item.name, category: item.room ?? null, description: item.description,
      capacity: item.lodging?.capacity ?? (capacity ? Number(capacity[1]) : null),
      adults: item.lodging?.adults ?? null, children: item.lodging?.children ?? null,
      bedrooms: item.lodging?.bedrooms ?? null, beds: item.lodging?.beds ?? null,
      amenities: item.lodging?.amenities ?? null, restrictions: item.lodging?.restrictions ?? null,
      providerCategoryId: null, mapObjectId: null, features: item.detail || null,
      photos: [picture(site, item.photo)].filter((url): url is string => url !== null),
      url: siteLink("/prozhivanie"),
      enquiryUrl: item.room ? siteLink("/bronirovanie?room=" + item.room) : siteLink("/bronirovanie"),
    };
  });
}
export function services(site: SiteData) {
  return serviceSections.flatMap((section) => {
    const page = site[section];
    const url = siteLink("/" + section);
    const items = page.items.filter((item) => item.visible).map((item) => ({
      id: section + "-" + item.id, section, title: item.name, description: item.description,
      details: item.detail || null, photo: picture(site, item.photo), url,
    }));
    return [{ id: section as string, section, title: page.heading, description: page.intro,
      details: page.body || null, photo: picture(site, page.photo), url }, ...items];
  });
}

export const pageQuery = {
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
};
const eventQuery = z.strictObject({ ...pageQuery, q: z.string().trim().min(1).max(120).optional(),
  from: z.iso.date().optional(), to: z.iso.date().optional(),
}).refine(({ from, to }) => !from || !to || from <= to);
type EventResult = ReturnType<typeof import("../../../events-original/lib/server/assistant-events").assistantEvents>;

function eventLinks<T extends { url: string; photo: string | null }>(item: T) {
  return { ...item, url: siteLink(item.url), photo: item.photo ? siteLink(item.photo) : null };
}
export function envelope<T>(source: string, data: T) {
  return { source, retrievedAt: new Date().toISOString(), data };
}

export async function events(id?: string, query = new URLSearchParams()) {
  const key = process.env.ASSISTANT_EVENTS_KEY;
  if (!key) throw new ApiError(503, "events_unavailable");
  const url = new URL("/meropriyatiya/api/internal/assistant/events", process.env.EVENTS_ORIGINAL_ORIGIN ?? "http://127.0.0.1:3271");
  if (id) url.searchParams.set("id", objectId.parse(id));
  else {
    const filters = eventQuery.parse(Object.fromEntries(query));
    for (const [name, value] of Object.entries(filters))
      if (value !== undefined) url.searchParams.set(name, String(value));
  }
  const response = await fetch(url, { headers: { Authorization: "Bearer " + key },
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(3500) }).catch(() => null);
  if (!response?.ok) throw new ApiError(503, "events_unavailable");
  const result = await response.json() as EventResult;
  if (result.item) {
    const item = result.item;
    return { item: {
      ...eventLinks(item),
      registrationUrl: item.registrationUrl ? siteLink(item.registrationUrl) : null,
      activities: item.activities.map((activity) => ({
        ...activity,
        image: activity.image ? { ...activity.image, src: siteLink(activity.image.src) } : null,
        gallery: activity.gallery.map((image) => ({ ...image, src: siteLink(image.src) })),
      })),
    } };
  }
  if (id || !result.items) throw new ApiError(404, "not_found");
  return { items: result.items.map(eventLinks), total: result.total, limit: result.limit, offset: result.offset };
}

export async function knowledge(resource: string, id: string | undefined, query: URLSearchParams) {
  if (resource === "events") return envelope("events-original/sqlite", await events(id, query));
  if (!["complex", "faq", "accommodations", "services"].includes(resource) ||
      (id && (resource === "faq" || resource === "complex"))) throw new ApiError(404, "not_found");
  const site = await publishedSite();
  const source = cmsEnabled() ? "cms/published" : "site/defaults";
  if (resource === "complex") return envelope(source, {
    name: "Загородный комплекс «Рублевка»", description: site.book.description,
    address: site.contacts.address, location: site.contacts.location,
    contacts: { phone: site.contacts.phone, email: site.contacts.email, url: siteLink("/kontakty") },
    visitingTerms: null, stayRules: null, checkIn: null, checkOut: null, url: siteLink("/"),
  });
  if (resource === "faq") return envelope(source, { items: [], status: "unpublished" });
  const items = resource === "accommodations" ? accommodations(site) : services(site);
  if (id) {
    const item = items.find((item) => item.id === (resource === "services" ? serviceId : objectId).parse(id));
    if (!item) throw new ApiError(404, "not_found");
    return envelope(source, item);
  }
  const filters = z.strictObject({
    ...pageQuery, q: z.string().trim().min(1).max(120).optional(),
    ...(resource === "accommodations" ? {
      category: objectId.optional(), capacity: z.coerce.number().int().min(1).max(100).optional(),
      bedrooms: z.coerce.number().int().min(1).max(100).optional(),
    } : { section: z.enum(serviceSections).optional() }),
  }).parse(Object.fromEntries(query));
  const filtered = items.filter((item) =>
    (!filters.q || item.title.toLocaleLowerCase("ru").includes(filters.q.toLocaleLowerCase("ru"))) &&
    (!("category" in filters) || !filters.category || ("category" in item && item.category === filters.category)) &&
    (!("capacity" in filters) || !filters.capacity || ("capacity" in item && (item.capacity ?? 0) >= filters.capacity)) &&
    (!("bedrooms" in filters) || !filters.bedrooms || ("bedrooms" in item && (item.bedrooms ?? 0) >= filters.bedrooms)) &&
    (!("section" in filters) || !filters.section || ("section" in item && item.section === filters.section)));
  return envelope(source, {
    items: filtered.slice(filters.offset, filters.offset + filters.limit)
      .map(({ id, title, url, ...item }) => ({ id, title, url,
        ...("capacity" in item ? { category: item.category, capacity: item.capacity, photos: item.photos }
          : { section: item.section, photo: item.photo }),
      })),
    total: filtered.length, limit: filters.limit, offset: filters.offset,
  });
}

export async function administrator() {
  const { phone, tel } = contactLinks((await publishedSite()).contacts);
  return { title: phone, url: tel };
}
