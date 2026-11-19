import type Database from "better-sqlite3";
import { eventDateParts, formatEventDate, formatEventSchedule, nextIsoDate } from "../format";
import { mediaUrl } from "../media";
import { formatRub, priceText } from "../money";
import type { ActivityView, CommunityView, EventCardView, EventView, PaymentView, RegistrationReceipt } from "../types";
import { listActivities, listGallery, parseDetails } from "./repo/activities";
import type { EventRow } from "./repo/events";
import type { RegistrationWithActivities } from "./repo/registrations";
import { getSettings } from "./repo/settings";
import { usesPhone, usesQr } from "./validation";

/** Преобразование записей БД в модели публичных страниц. */

export function toEventView(event: EventRow): EventView {
  const hero = mediaUrl(event.hero_image);
  const schedule = formatEventSchedule(event);
  const { day, month } = eventDateParts(event.event_date);
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    dateLabel: formatEventDate(event.event_date),
    day,
    month,
    // Платное участие видно рядом с датой — до заполнения анкеты.
    scheduleFacts: event.price_kopecks ? [...schedule.facts, { label: "Участие", value: formatRub(event.price_kopecks) }] : schedule.facts,
    timeLabel: schedule.time,
    description: event.short_description,
    heroImage: hero ? { src: hero, alt: `${event.hero_fit === "contain" ? "Афиша" : "Фотография"} мероприятия «${event.title}»` } : null,
    heroFit: event.hero_fit,
    priceKopecks: event.price_kopecks,
    extraInfo: event.extra_info,
    longDescription: event.long_description,
    locationLabel: event.location_text,
  };
}

/** Карточка для списка на главной; `today` — сегодняшняя дата по времени комплекса. */
export function toEventCardView(event: EventRow, today: string): EventCardView {
  const { weekday } = eventDateParts(event.event_date);
  const soonLabel = event.event_date === today ? "Сегодня" : event.event_date === nextIsoDate(today) ? "Завтра" : null;
  return { ...toEventView(event), isoDate: event.event_date, weekday, soonLabel };
}

/** Только активные услуги мероприятия, в порядке, заданном администратором. */
export function getPublicActivities(db: Database.Database, eventId: number): ActivityView[] {
  const rows = listActivities(db, eventId, { activeOnly: true });
  const gallery = listGallery(
    db,
    rows.map((row) => row.id),
  );
  return rows.map((row) => {
    const card = mediaUrl(row.card_image);
    return {
      id: row.id,
      title: row.title,
      teaser: row.short_description,
      description: row.long_description,
      image: card ? { src: card, alt: row.title } : null,
      gallery: gallery
        .filter((image) => image.activity_id === row.id)
        .map((image) => ({ src: mediaUrl(image.image_path), alt: image.alt_text || row.title }))
        .filter((image): image is { src: string; alt: string } => !!image.src),
      pricingType: row.pricing_type,
      priceKopecks: row.fixed_price_kopecks,
      priceSuffix: row.price_suffix,
      time: row.start_time,
      duration: row.duration_text,
      details: parseDetails(row.details),
    };
  });
}

export function getPublicSettings(db: Database.Database): { payment: PaymentView; community: CommunityView } {
  const settings = getSettings(db);
  const paymentQr = mediaUrl(settings.payment_qr_image);
  const communityQr = mediaUrl(settings.community_qr_image);
  const communityLinks: CommunityView["links"] = [
    { platform: "telegram" as const, label: "Telegram", url: settings.community_target_url },
    { platform: "vk" as const, label: "VK", url: settings.community_vk_url },
    { platform: "max" as const, label: "MAX", url: settings.community_max_url },
  ].filter((link): link is CommunityView["links"][number] => !!link.url);
  return {
    payment: {
      method: settings.payment_method,
      qr: usesQr(settings.payment_method) && paymentQr ? { src: paymentQr, alt: "QR-код для оплаты через Сбербанк" } : null,
      phone: usesPhone(settings.payment_method) ? settings.payment_phone : null,
      recipient: usesPhone(settings.payment_method) ? settings.payment_recipient : null,
      url: settings.payment_target_url,
    },
    community: {
      title: settings.community_title,
      description: settings.community_description,
      links: communityLinks,
      qr: communityQr ? { src: communityQr, alt: "QR-код Telegram-сообщества «Рублёвки»" } : null,
    },
  };
}

export function toReceipt(registration: RegistrationWithActivities, eventTitle: string): RegistrationReceipt {
  return {
    publicId: registration.public_id,
    eventTitle,
    fullName: registration.full_name,
    phone: registration.phone,
    messenger: registration.messenger,
    eventPriceKopecks: registration.event_price_kopecks,
    hasPaidActivities: registration.activities.some(
      (activity) => activity.pricing_type_snapshot === "fixed" && (activity.fixed_price_kopecks_snapshot ?? 0) > 0,
    ),
    activities: registration.activities.map((activity) => ({
      title: activity.activity_title_snapshot,
      priceText: priceText(activity.pricing_type_snapshot, activity.fixed_price_kopecks_snapshot, activity.price_suffix_snapshot),
    })),
    totalKopecks: registration.fixed_total_kopecks,
  };
}
