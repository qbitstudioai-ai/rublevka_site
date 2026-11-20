import { Fragment } from "react";
import type { ManifestoChapter } from "@/content/home";

export function ManifestoText({ chapter }: { chapter: ManifestoChapter }) {
  return (
    <>
      <p className="manifesto-subtitle">{chapter.subtitle}</p>
      <div className="manifesto-prose">
        {chapter.paragraphs.map((paragraph, index) => (
          <Fragment key={index}>
            <p>{paragraph}</p>
            {index === 2 && (
              <p className="manifesto-emphasis">
                <strong>{chapter.emphasis}</strong>
              </p>
            )}
          </Fragment>
        ))}
        <p className="manifesto-closing"><strong>{chapter.closing}</strong></p>
      </div>
    </>
  );
}
