import Image from "next/image";

import { resolveMedia, type MediaId } from "@/content/media";

type MediaFrameProps = {
  mediaId: MediaId;
  sizes: string;
  className?: string;
  eager?: boolean;
};

export function MediaFrame({ mediaId, sizes, className = "", eager = false }: MediaFrameProps) {
  const asset = resolveMedia(mediaId);

  return (
    <figure className={`media-frame ${className}`.trim()} data-media-id={asset.id}>
      <Image
        className="media-frame__image"
        src={asset.src}
        alt={asset.alt}
        width={asset.width}
        height={asset.height}
        sizes={sizes}
        loading={eager ? "eager" : "lazy"}
        style={{ objectPosition: asset.focalPoint }}
      />
    </figure>
  );
}
