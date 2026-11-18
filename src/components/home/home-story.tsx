import { experiences } from "@/content/home";

import { ButtonLink } from "../ui/button-link";
import { ChapterHeading } from "../ui/chapter-heading";
import { MediaFrame } from "../ui/media-frame";
import { OrnamentDivider } from "../ui/ornament-divider";
import { ChapterNav } from "./chapter-nav";
import { ExperienceCard } from "./experience-card";

export function HomeStory() {
  return (
    <div className="story-shell">
      <a className="skip-link" href="#story-content">
        Перейти к содержанию
      </a>
      <ChapterNav />

      <main id="story-content">
        <section className="chapter chapter--hero" id="chapter-1" aria-labelledby="hero-title">
          <div className="chapter__spine" aria-hidden="true">
            <span>I</span>
          </div>
          <div className="hero-page">
            <div className="hero-page__copy reveal">
              <span className="hero-page__chapter" aria-hidden="true">
                I
              </span>
              <h1 id="hero-title">
                <span>Р</span>ублёвка
              </h1>
              <p>Там, где город замолкает</p>
              <OrnamentDivider />
              <ButtonLink href="#chapter-2">Листать дальше</ButtonLink>
            </div>
            <div className="hero-page__visual reveal">
              <MediaFrame
                mediaId="house-oaks"
                sizes="(max-width: 760px) 100vw, (max-width: 1100px) 55vw, 48rem"
                className="media-frame--hero"
                eager
              />
              <span className="hero-page__folio" aria-hidden="true">
                01
              </span>
            </div>
            <a className="scroll-cue" href="#chapter-2" aria-label="Перейти ко второй главе">
              <span aria-hidden="true">↓</span>
            </a>
          </div>
        </section>

        <section className="chapter chapter--places" id="chapter-2" aria-labelledby="places-title">
          <div className="chapter__spine" aria-hidden="true">
            <span>II</span>
          </div>
          <div className="chapter-page">
            <ChapterHeading number="II" id="places-title" align="center">
              Место, где вас ждут
            </ChapterHeading>
            <OrnamentDivider />
            <div className="experience-grid">
              {experiences.map((experience, index) => (
                <ExperienceCard key={experience.id} experience={experience} index={index} />
              ))}
            </div>
            <span className="page-folio" aria-hidden="true">
              II
            </span>
          </div>
        </section>

        <section className="chapter chapter--quiet" id="chapter-3" aria-labelledby="quiet-title">
          <div className="chapter__spine" aria-hidden="true">
            <span>III</span>
          </div>
          <div className="quiet-page">
            <MediaFrame
              mediaId="oak-forest"
              sizes="(max-width: 760px) 100vw, (max-width: 1200px) 88vw, 78rem"
              className="media-frame--forest reveal"
            />
            <div className="quiet-page__closing">
              <div className="quiet-page__copy reveal">
                <ChapterHeading number="III" id="quiet-title">
                  Тишина, которую хочется сохранить
                </ChapterHeading>
                <p>Дубовый лес, тёплый свет и время, которое наконец никуда не спешит.</p>
                <ButtonLink href="#chapter-1">Вернуться к началу</ButtonLink>
              </div>
              <div className="quiet-page__plate reveal">
                <MediaFrame
                  mediaId="woodland-path"
                  sizes="(max-width: 760px) 88vw, (max-width: 1200px) 42vw, 37rem"
                  className="media-frame--plate"
                />
              </div>
            </div>
            <OrnamentDivider />
            <span className="page-folio" aria-hidden="true">
              III
            </span>
          </div>
        </section>
      </main>
    </div>
  );
}
