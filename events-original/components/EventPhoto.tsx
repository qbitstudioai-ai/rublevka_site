import type { ImageAsset } from "@/lib/types";

type Props = {
  image: ImageAsset;
  /** Фото рядом с названием — для экранного диктора декоративное. */
  decorative?: boolean;
  lazy?: boolean;
};

/**
 * Горизонтальное фото мероприятия (режим «Заполнить рамку») внутри рамки с position: relative
 * и overflow: hidden: фото заполняет рамку, края обрезаются. Афиши показывает EventPoster.
 */
export function EventPhoto({ image, decorative = false, lazy = false }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="photo-main" src={image.src} alt={decorative ? "" : image.alt} loading={lazy ? "lazy" : undefined} />
  );
}
