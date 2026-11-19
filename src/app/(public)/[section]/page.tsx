import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuestGuide } from "@/components/guide/guide-page";
import {
  publicContent,
  catalogFor,
  catalogAsset,
  contactLinks,
} from "@/server/cms/public";
import { sectionIds, type SectionId } from "@/content/sections";

import { getSiteUrl, isIndexingEnabled } from "@/server/site-url";
import "./guide.css";

export const dynamic = "force-dynamic";
export const dynamicParams = false;
export function generateStaticParams() {
  return sectionIds.map((section) => ({ section }));
}
type Props = { params: Promise<{ section: string }> };
async function sectionId({ params }: Props): Promise<SectionId> {
  const { section } = await params;
  const id = sectionIds.find((s) => s === section);
  if (!id) notFound();
  return id;
}
export async function generateMetadata(props: Props): Promise<Metadata> {
  const id = await sectionId(props);
  const page = await publicContent(id);
  return {
    title: page.title,
    description: page.description,
    robots: {
      index: isIndexingEnabled && page.indexable,
      follow: isIndexingEnabled,
    },
    alternates: { canonical: "/" + id },
  };
}
export default async function Page(props: Props) {
  const id = await sectionId(props),
    [page, contacts, media] = await Promise.all([
      publicContent(id),
      publicContent("contacts"),
      publicContent("media"),
    ]),
    reception = contactLinks(contacts),
    catalog = catalogFor(media.items),
    base = getSiteUrl(),
    url = new URL("/" + id, base).href;
  const business = {
    "@type": "LodgingBusiness",
    "@id": new URL("/#complex", base).href,
    name: "Загородный комплекс «Рублевка»",
    telephone: reception.phone,
    address: reception.address,
    geo: {
      "@type": "GeoCoordinates",
      latitude: reception.latitude,
      longitude: reception.longitude,
    },
  };
  const schema = {
    "@context": "https://schema.org",
    "@type":
      id === "galereya"
        ? "ImageGallery"
        : id === "kontakty"
          ? "ContactPage"
          : "WebPage",
    name: page.heading,
    url,
    description: page.description,
    inLanguage: "ru",
    about: business,
    image: (page.gallery ?? [page.photo]).map(
      (media) => new URL(catalogAsset(catalog, media).src, base).href,
    ),
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Рублевка", item: base.href },
        { "@type": "ListItem", position: 2, name: page.heading, item: url },
      ],
    },
  };
  return (
    <>
      <GuestGuide id={id} page={page} contact={reception} catalog={catalog} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}
