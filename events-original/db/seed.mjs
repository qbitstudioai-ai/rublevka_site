// Демонстрационные данные: мероприятие «Встреча на Рублёвке», его услуги и общие настройки.
// Seed идемпотентен: существующее мероприятие с тем же slug не перезаписывается.

const imageProxy = (path, width = 900) => `https://images.weserv.nl/?url=rublevka34.com${path}&w=${width}&output=webp`;

export const DEMO_EVENT_SLUG = "vstrecha-na-rublevke";

const demoEvent = {
  slug: DEMO_EVENT_SLUG,
  title: "Встреча на Рублёвке",
  event_date: "2026-10-24",
  start_time: "16:00",
  short_description: "Заполните данные участника и, если хотите, добавьте активности к своему дню.",
  location_text: "На берегу Волги · Краснослободск",
  hero_image: imageProxy("/wp-content/uploads/2024/03/c289b9b9a8f02440.jpg", 1400),
  status: "published",
};

const demoActivities = [
  {
    title: "Литературная гостиная",
    short_description: "Камерный разговор о книгах с чаем и десертами.",
    long_description: "Неспешная встреча в малом зале: ведущий задаёт тему, а гости могут слушать или включаться в разговор.",
    start_time: "14:00",
    duration_text: "около 90 минут",
    pricing_type: "fixed",
    fixed_price_kopecks: 350000,
    price_suffix: null,
    card_image: imageProxy("/wp-content/uploads/2024/10/img-20241027-wa0027-1024x683.webp"),
    details: ["Количество мест ограничено", "Чай и десерты включены"],
    gallery: [
      ["/wp-content/uploads/2024/10/img-20241027-wa0027-1024x683.webp", "Литературная гостиная, общий план"],
      ["/wp-content/uploads/2024/10/img-20241027-wa0016-%E2%80%94-kopiya-1024x683.jpg", "Литературная гостиная, гости"],
    ],
  },
  {
    title: "Проживание",
    short_description: "Останьтесь на ночь в деревянном доме среди дубов.",
    long_description: "Администратор подберёт подходящий номер или отдельный дом с учётом состава гостей и пожеланий.",
    start_time: null,
    duration_text: null,
    pricing_type: "contact",
    fixed_price_kopecks: null,
    price_suffix: "Стоимость уточнит администратор",
    card_image: imageProxy("/wp-content/uploads/2024/03/c640b9cfe680942b-1024x683.jpg"),
    details: ["Категория и стоимость уточняются", "Завтрак обсуждается при подтверждении", "Администратор свяжется с вами после регистрации."],
    gallery: [
      ["/wp-content/uploads/2024/03/c640b9cfe680942b-1024x683.jpg", "Деревянный дом снаружи"],
      ["/wp-content/uploads/2024/03/85b2a70a5a97c9a3.jpg", "Дом среди деревьев"],
    ],
  },
  {
    title: "Песни у костра",
    short_description: "Тёплый финал дня с гитарой и живым огнём.",
    long_description: "Соберёмся на открытом воздухе после основной программы. Можно подпевать, слушать и просто быть рядом.",
    start_time: "20:30",
    duration_text: null,
    pricing_type: "free",
    fixed_price_kopecks: 0,
    price_suffix: null,
    card_image: imageProxy("/wp-content/uploads/2024/03/4cb31d4ad68bdfb0.jpg"),
    details: ["Пледы предоставляются", "Детям можно вместе со взрослыми", "Проведение зависит от погоды."],
    gallery: [
      ["/wp-content/uploads/2024/03/4cb31d4ad68bdfb0.jpg", "Территория комплекса вечером"],
      ["/wp-content/uploads/2024/03/6511bd0b4dc4dc7b-1024x683.jpg", "Зона отдыха на открытом воздухе"],
    ],
  },
  {
    title: "Вечер в банном комплексе",
    short_description: "Спокойное завершение встречи в отдельном срубе.",
    long_description: "Банный комплекс с парной и зоной отдыха бронируется для небольшой компании после основной программы.",
    start_time: null,
    duration_text: null,
    pricing_type: "fixed",
    fixed_price_kopecks: 650000,
    price_suffix: "за компанию",
    card_image: imageProxy("/wp-content/uploads/2024/03/232f2692d915f594-1024x683.jpg"),
    details: ["До 10 гостей", "Точное время согласует администратор", "Банные принадлежности включены"],
    gallery: [
      ["/wp-content/uploads/2024/03/232f2692d915f594-1024x683.jpg", "Банный комплекс снаружи"],
      ["/wp-content/uploads/2024/03/2b53cf58d143ad27-1024x683.jpg", "Зона отдыха банного комплекса"],
    ],
  },
];

// Демонстрационные QR из public/mock: закодирован поясняющий текст, а не реквизиты.
// Текст и ссылки сообществ задаёт миграция 005 — seed их не меняет.
const demoSettings = {
  payment_qr_image: "/mock/qr-payment-demo.svg",
  community_qr_image: "/mock/qr-community-demo.svg",
};

export function seedDemo(db) {
  const result = { event: "skipped", settings: "skipped" };
  db.transaction(() => {
    const existing = db.prepare("SELECT id FROM events WHERE slug = ?").get(DEMO_EVENT_SLUG);
    if (!existing) {
      const { lastInsertRowid: eventId } = db
        .prepare(`INSERT INTO events (slug, title, event_date, start_time, short_description, location_text, hero_image, status)
                  VALUES (@slug, @title, @event_date, @start_time, @short_description, @location_text, @hero_image, @status)`)
        .run(demoEvent);
      const insertActivity = db.prepare(`INSERT INTO activities
        (event_id, title, short_description, long_description, start_time, duration_text, pricing_type, fixed_price_kopecks, price_suffix, card_image, details, sort_order)
        VALUES (@event_id, @title, @short_description, @long_description, @start_time, @duration_text, @pricing_type, @fixed_price_kopecks, @price_suffix, @card_image, @details, @sort_order)`);
      const insertImage = db.prepare("INSERT INTO activity_images (activity_id, image_path, alt_text, sort_order) VALUES (?, ?, ?, ?)");
      demoActivities.forEach(({ gallery, details, ...activity }, index) => {
        const { lastInsertRowid: activityId } = insertActivity.run({
          ...activity,
          event_id: eventId,
          details: JSON.stringify(details),
          sort_order: index + 1,
        });
        gallery.forEach(([imagePath, alt], imageIndex) => insertImage.run(activityId, imageProxy(imagePath), alt, imageIndex + 1));
      });
      result.event = "created";
    }

    // Демо-QR ставятся, только если QR ещё не заданы.
    const settings = db.prepare("SELECT payment_qr_image, community_qr_image FROM app_settings WHERE id = 1").get();
    if (settings && !settings.payment_qr_image && !settings.community_qr_image) {
      db.prepare(`UPDATE app_settings SET payment_qr_image = @payment_qr_image, community_qr_image = @community_qr_image,
                  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1`).run(demoSettings);
      result.settings = "updated";
    }
  })();
  return result;
}
