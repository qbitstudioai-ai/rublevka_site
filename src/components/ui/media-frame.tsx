import Image from "next/image";

import { resolveMedia, type MediaId, type MediaAsset } from "@/content/media";

type MediaFrameProps = {
  sizes: string;
  className?: string;
  eager?: boolean;
} & (
  { asset: MediaAsset; mediaId?: never } | { mediaId: MediaId; asset?: never }
);

export function MediaFrame({
  mediaId,
  asset: supplied,
  sizes,
  className = "",
  eager = false,
}: MediaFrameProps) {
  const asset = supplied ?? resolveMedia(mediaId!);

  return (
    <figure
      className={`media-frame ${className}`.trim()}
      data-media-id={asset.id}
    >
      <Image
        className="media-frame__image"
        src={asset.src}
        alt={asset.alt}
        width={asset.width}
        height={asset.height}
        sizes={sizes}
        unoptimized={asset.src.startsWith("/cms-media/")}
        loading={eager ? "eager" : "lazy"}
        style={{ objectPosition: asset.focalPoint }}
      />
    </figure>
  );
}
