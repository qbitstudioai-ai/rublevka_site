import type { CommunityView } from "@/lib/types";
import { PlatformIcon } from "./PlatformIcon";

type Props = {
  community: CommunityView;
};

/**
 * Блок сообществ «Рублёвки»: текст, кнопки платформ, у которых в настройках задана ссылка,
 * и QR Telegram-сообщества — чтобы с компьютера перейти в сообщество с телефона.
 */
export function CommunitySection({ community }: Props) {
  if (community.links.length === 0 && !community.qr) return null;

  return (
    <section className="community-section" aria-labelledby="community-title">
      <div className="community-inner">
        <div className="community-copy">
          <p className="eyebrow">Сообщества «Рублёвки»</p>
          <h2 id="community-title">{community.title}</h2>
          {community.description && <p>{community.description}</p>}
        </div>
        {community.links.length > 0 && (
          <ul className="community-platforms">
            {community.links.map((link) => (
              <li key={link.platform}>
                <a className="community-platform" href={link.url} target="_blank" rel="noopener noreferrer">
                  <PlatformIcon platform={link.platform} className="community-platform-icon" />
                  <span className="community-platform-name">
                    <span className="visually-hidden">Сообщество «Рублёвки» в </span>
                    {link.label}
                  </span>
                  <span className="community-platform-arrow" aria-hidden="true">
                    ↗
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
        {community.qr && (
          <figure className="community-qr">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={community.qr.src} alt={community.qr.alt} width={200} height={200} />
            <figcaption>Сообщество «Рублёвки» в Telegram</figcaption>
          </figure>
        )}
      </div>
    </section>
  );
}
