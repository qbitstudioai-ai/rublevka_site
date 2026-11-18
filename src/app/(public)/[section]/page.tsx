import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuestGuide } from "@/components/guide/guide-page";
import { guide, reception } from "@/content/guest-guide";
import { sectionIds, type SectionId } from "@/content/sections";
import { resolveMedia } from "@/content/media";
import { getSiteUrl } from "@/server/site-url";
import "./guide.css";

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
  return {
    title: guide[id].title,
    description: guide[id].description,
    alternates: { canonical: "/" + id },
  };
}
export default async function Page(props: Props) {
  const id = await sectionId(props),
    page = guide[id],
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
      (media) => new URL(resolveMedia(media).src, base).href,
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
      <GuestGuide id={id} page={page} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}
