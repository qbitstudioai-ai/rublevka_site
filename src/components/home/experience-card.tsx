import type { Experience } from "@/content/home";

import { MediaFrame } from "../ui/media-frame";

type ExperienceCardProps = {
  experience: Experience;
  index: number;
};

export function ExperienceCard({ experience, index }: ExperienceCardProps) {
  const sizes =
    experience.layout === "hero"
      ? "(max-width: 700px) 100vw, (max-width: 1100px) 60vw, 52rem"
      : experience.layout === "wide"
        ? "(max-width: 700px) 100vw, (max-width: 1100px) 60vw, 48rem"
        : "(max-width: 700px) 100vw, (max-width: 1100px) 40vw, 34rem";

  return (
    <article className={`experience-card experience-card--${experience.layout} reveal`}>
      <MediaFrame mediaId={experience.mediaId} sizes={sizes} />
      <div className="experience-card__caption">
        <span aria-hidden="true">0{index + 1}</span>
        <h3>{experience.title}</h3>
      </div>
    </article>
  );
}
