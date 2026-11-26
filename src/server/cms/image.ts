import { createHash, randomUUID } from "node:crypto";
import {
  readFile,
  mkdir,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import sharp from "sharp";
import type { MediaAsset } from "@/content/media";

export const maxImageBytes = 8 * 1024 * 1024;
export const cmsImageName = /^[a-f0-9]{64}\.webp$/;

export class ImageInputError extends Error {}

export async function readImageInput(body: ReadableStream<Uint8Array> | null) {
  if (!body) throw new ImageInputError("Выберите фотографию.");
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return Buffer.concat(chunks, length);
      length += value.byteLength;
      if (length > maxImageBytes) {
        await reader.cancel();
        throw new ImageInputError("Максимальный размер файла — 8 МБ.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
}

export async function prepareCmsImage(input: Buffer) {
  if (input.length > maxImageBytes)
    throw new ImageInputError("Максимальный размер файла — 8 МБ.");
  try {
    const photo = sharp(input, {
      limitInputPixels: 24_000_000,
      failOn: "error",
    });
    const meta = await photo.metadata();
    if (
      !["jpeg", "png", "webp", "avif", "heif"].includes(meta.format ?? "") ||
      (meta.pages ?? 1) > 1 ||
      (meta.format === "heif" && meta.compression !== "av1")
    )
      throw new Error();
    const { data: bytes, info } = await photo
      .rotate()
      .resize({
        width: 1800,
        height: 1800,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    const digest = createHash("sha256").update(bytes).digest("hex");
    const filename = digest + ".webp";
    const src = "/cms-media/" + filename;
    const asset: MediaAsset & { name: string } = {
      id: "upload-" + digest,
      src,
      sourceUrl: src,
      width: info.width,
      height: info.height,
      alt: "",
      description: "",
      name: "Новая фотография",
      focalPoint: "50% 50%",
    };
    return { asset, bytes, filename };
  } catch {
    throw new ImageInputError(
      "Загрузите статичное фото JPEG, PNG, WebP или AVIF размером до 24 мегапикселей.",
    );
  }
}

// Replace this byte store with an object storage adapter without changing document references.
function directory() {
  const location = process.env.CMS_MEDIA_DIR;
  if (
    process.env.NODE_ENV === "production" &&
    (!location || !isAbsolute(location))
  ) {
    throw new Error("CMS_MEDIA_DIR must be a persistent absolute path.");
  }
  return resolve(/*turbopackIgnore: true*/ location ?? ".cms-media");
}

export async function hasCmsImage(filename: string) {
  if (!cmsImageName.test(filename)) return false;
  try {
    return (
      await stat(/*turbopackIgnore: true*/ join(directory(), filename))
    ).isFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function cmsImageMetadata(filename: string) {
  if (!cmsImageName.test(filename)) return null;
  try {
    // Reading the file first avoids keeping a Windows file handle open in
    // libvips after metadata inspection (important for cleanup and replaces).
    const bytes = await readFile(
      /*turbopackIgnore: true*/ join(directory(), filename),
    );
    const metadata = await sharp(bytes).metadata();
    if (!metadata.width || !metadata.height) return null;
    return { width: metadata.width, height: metadata.height };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function storeCmsImage(filename: string, bytes: Buffer) {
  if (!cmsImageName.test(filename)) throw new Error("Invalid media name.");
  const dir = directory();
  await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  const temporary = join(dir, randomUUID() + ".tmp");
  try {
    await writeFile(/*turbopackIgnore: true*/ temporary, bytes, { flag: "wx" });
    await rename(
      /*turbopackIgnore: true*/ temporary,
      /*turbopackIgnore: true*/ join(dir, filename),
    );
  } finally {
    await unlink(/*turbopackIgnore: true*/ temporary).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      },
    );
  }
}

export async function cmsImageResponse(filename: string, cacheControl: string) {
  if (!cmsImageName.test(filename)) return new Response(null, { status: 404 });
  try {
    const bytes = await readFile(
      /*turbopackIgnore: true*/ join(directory(), filename),
    );
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": cacheControl,
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return new Response(null, { status: 404 });
    throw error;
  }
}
