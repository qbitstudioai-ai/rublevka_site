/**
 * Модели представления для публичных страниц. Строятся на сервере из записей SQLite
 * (`lib/server/public-data.ts`) и передаются в клиентские компоненты.
 */

import type { PricingType } from "./money";

export type ImageAsset = {
  src: string;
  alt: string;
};

export type EventView = {
  id: number;
  slug: string;
  title: string;
  /** «24 октября 2026» — дата начала. */
  dateLabel: string;
  /** «24» — для листка с датой. */
  day: string;
  /** «октября». */
  month: string;
  /** Пары для первого экрана: «Дата / Время» или «Начало / Окончание» у многодневных. */
  scheduleFacts: { label: string; value: string }[];
  /** Для карточки списка: «16:00 – 22:00» или «16:00 · до 2 ноября». */
  timeLabel: string;
  description: string;
  heroImage: ImageAsset | null;
  /** cover — фото заполняет рамку; contain — «афиша»: фото целиком в белой рамке на персиковой подложке. */
  heroFit: "cover" | "contain";
  /** Стоимость участия в копейках (обязательна при регистрации); null — участие бесплатное. */
  priceKopecks: number | null;
  /** Текст блока «Дополнительно» рядом с анкетой; пустая строка — блока нет. */
  extraInfo: string;
  /** Подробное описание — свиток «Подробнее» в шапке; пустая строка — свитка нет. */
  longDescription: string;
  locationLabel: string | null;
};

/** Карточка мероприятия в публичном списке на главной. */
export type EventCardView = EventView & {
  /** «2026-10-24» — для атрибута datetime. */
  isoDate: string;
  /** «суббота». */
  weekday: string;
  /** Пометка для ближайших дат; null — дата дальше завтрашней. */
  soonLabel: "Сегодня" | "Завтра" | null;
};

export type ActivityView = {
  id: number;
  title: string;
  teaser: string;
  description: string;
  image: ImageAsset | null;
  gallery: ImageAsset[];
  pricingType: PricingType;
  priceKopecks: number | null;
  priceSuffix: string | null;
  time: string | null;
  duration: string | null;
  /** Пункты подробностей: условия, что включено, ограничения. */
  details: string[];
};

/** Как участник может оплатить: QR-код, перевод по номеру телефона или оба способа. */
export type PaymentView = {
  method: "qr" | "phone" | "both";
  /** QR показывается, только если способ его включает и файл загружен. */
  qr: ImageAsset | null;
  /** Номер для перевода — только если способ его включает. */
  phone: string | null;
  recipient: string | null;
  /** Ссылка для кнопки «Открыть Сбербанк». */
  url: string | null;
};

export type CommunityPlatform = "telegram" | "vk" | "max";

/** Блок сообществ: показываются только платформы, для которых задана ссылка, и QR, если он загружен. */
export type CommunityView = {
  title: string;
  description: string;
  links: { platform: CommunityPlatform; label: string; url: string }[];
  /** QR Telegram-сообщества. */
  qr: ImageAsset | null;
};

/** Ответ сервера после успешной регистрации — только то, что показывает success-state. */
export type RegistrationReceipt = {
  publicId: string;
  eventTitle: string;
  fullName: string;
  phone: string;
  /** null — мессенджер не указан. */
  messenger: string | null;
  /** Стоимость участия на момент регистрации; 0 — бесплатно. */
  eventPriceKopecks: number;
  activities: { title: string; priceText: string }[];
  /** Есть ли среди услуг платные с фиксированной ценой — для подписи «участие и услуги». */
  hasPaidActivities: boolean;
  totalKopecks: number;
};
