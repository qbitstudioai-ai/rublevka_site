import { notFound } from "next/navigation";
import { SiteEditScreen } from "@/components/site-admin/edit-screen";
import { hasSiteKey } from "@/server/cms/model";

export default async function SiteDocument({
  params, searchParams,
}: {
  params: Promise<{ document: string }>;
  searchParams: Promise<{ item?: string | string[] }>;
}) {
  const { document } = await params;
  const { item } = await searchParams;
  if (!hasSiteKey(document)) notFound();
  return <SiteEditScreen documentKey={document} selectedItem={typeof item === "string" ? item : undefined} />;
}
