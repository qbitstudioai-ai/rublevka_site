import { currentSiteUser } from "@/server/cms/auth";
import { cmsImageResponse } from "@/server/cms/image";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  if (!(await currentSiteUser())) return new Response(null, { status: 404 });
  return cmsImageResponse((await params).name, "private, no-store");
}
