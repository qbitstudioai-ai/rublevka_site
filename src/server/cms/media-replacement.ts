import type { CmsMedia } from "./model";

export function replaceMediaFile(
  current: CmsMedia,
  uploaded: CmsMedia,
): CmsMedia {
  return {
    ...current,
    src: uploaded.src,
    sourceUrl: uploaded.sourceUrl,
    width: uploaded.width,
    height: uploaded.height,
  };
}
