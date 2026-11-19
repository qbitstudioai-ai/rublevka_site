import { cmsImageName, cmsImageResponse } from "@/server/cms/image";
import { cmsEnabled, publicContent } from "@/server/cms/public";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  if (!cmsEnabled() || !cmsImageName.test(name))
    return new Response(null, { status: 404 });
  const { items } = await publicContent("media");
  if (!items.some((item) => item.src === "/cms-media/" + name))
    return new Response(null, { status: 404 });
  return cmsImageResponse(name, "public, max-age=3600");
}
