import { assistantRequest } from "@/server/assistant/http";

type Context = { params: Promise<{ parts: string[] }> };
export async function GET(request: Request, { params }: Context) {
  return assistantRequest(request, (await params).parts);
}
export async function POST(request: Request, { params }: Context) {
  return assistantRequest(request, (await params).parts);
}
