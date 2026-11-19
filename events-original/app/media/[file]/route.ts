import fs from "node:fs/promises";
import { resolveUploadPath } from "@/lib/server/uploads";

/**
 * Отдаёт загруженные изображения. Имя проверяется строгим шаблоном `<uuid>.webp|png`,
 * поэтому выйти за пределы UPLOADS_DIR (path traversal) невозможно.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const filePath = resolveUploadPath(file);
  if (!filePath) return new Response("Not found", { status: 404 });

  try {
    const data = await fs.readFile(filePath);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": file.endsWith(".png") ? "image/png" : "image/webp",
        // Имя файла уникально и не переиспользуется — можно кешировать надолго.
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
