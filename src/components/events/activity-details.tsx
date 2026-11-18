import { MediaFrame } from "@/components/ui/media-frame";
import { mediaId } from "./presentation";

type Props = {
  option: {
    longDescription: string;
    details: string;
    galleryIds: string[];
  };
};

export function ActivityDetails({ option }: Props) {
  const photos = option.galleryIds
    .map(mediaId)
    .filter((id) => id !== undefined);
  const features = option.details
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!option.longDescription && !features.length && !photos.length)
    return null;

  return (
    <details className="fest-service-details">
      <summary>Подробнее об услуге</summary>
      {option.longDescription && <p>{option.longDescription}</p>}
      {features.length > 0 && (
        <ul>
          {features.map((feature, index) => (
            <li key={index}>{feature}</li>
          ))}
        </ul>
      )}
      {photos.map((id) => (
        <MediaFrame
          key={id}
          mediaId={id}
          sizes="(max-width: 680px) 90vw, 22vw"
        />
      ))}
    </details>
  );
}
