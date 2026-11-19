import { requireSiteMutation } from "@/server/cms/auth";
import {
  ImageInputError,
  maxImageBytes,
  prepareCmsImage,
  readImageInput,
  storeCmsImage,
} from "@/server/cms/image";

export async function POST(request: Request) {
  try {
    await requireSiteMutation();
  } catch {
    return Response.json({ error: "Доступ запрещён." }, { status: 403 });
  }
  try {
    if (Number(request.headers.get("content-length")) > maxImageBytes)
      throw new ImageInputError("Максимальный размер файла — 8 МБ.");
    const { asset, bytes, filename } = await prepareCmsImage(
      await readImageInput(request.body),
    );
    await storeCmsImage(filename, bytes);
    return Response.json(
      { asset },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof ImageInputError
            ? error.message
            : "Не удалось сохранить фотографию.",
      },
      { status: error instanceof ImageInputError ? 400 : 500 },
    );
  }
}
