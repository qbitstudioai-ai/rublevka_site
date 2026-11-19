import { notFound } from "next/navigation";
import { sectionIds, type SectionId } from "@/content/sections";
import { SiteEditScreen } from "@/components/site-admin/edit-screen";
import { hasSiteKey } from "@/server/cms/model";

export default async function EditSeo({ params }: { params: Promise<{ document: string }> }) {
  const { document } = await params;
  if (!hasSiteKey(document) || (document !== "book" && !sectionIds.includes(document as SectionId))) notFound();
  return <SiteEditScreen documentKey={document} seoOnly />;
}
