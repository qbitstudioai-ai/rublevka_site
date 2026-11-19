import { expect, test } from "@playwright/test";
import { formatEventSchedule, isPastEvent, nextIsoDate } from "@/lib/format";
import { getPublicActivities, toEventCardView, toReceipt } from "@/lib/server/public-data";
import {
  deleteActivity,
  getActivity,
  listActivities,
  listGallery,
  moveActivity,
  setActivityActive,
  updateActivity,
} from "@/lib/server/repo/activities";
import {
  createEvent,
  deleteEvent,
  getEventById,
  getPublishedEventBySlug,
  listUpcomingPublishedEvents,
  setEventStatus,
  SlugTakenError,
  updateEvent,
} from "@/lib/server/repo/events";
import {
  countRegistrations,
  createRegistration,
  deleteRegistrationsForEvent,
  getRegistrationByPublicId,
  listRegistrations,
  RegistrationError,
} from "@/lib/server/repo/registrations";
import { activitySchema, eventSchema, registrationSchema } from "@/lib/server/validation";
import { activityInput, freshDb, makeActivity, makeEvent } from "./helpers";

const participant = (activityIds: number[] = []) =>
  registrationSchema.parse({ fullName: "Иванов Иван Иванович", phone: "+7 900 000-00-00", messenger: "Telegram: @ivanov", activityIds });

test.describe("мероприятия", () => {
  test("жизненный цикл: draft → published → edit → archived", () => {
    const { db } = freshDb();
    const { id, input } = makeEvent(db, { status: "draft", slug: "lifecycle" });

    expect(getPublishedEventBySlug(db, "lifecycle")).toBeNull();
    setEventStatus(db, id, "published");
    expect(getPublishedEventBySlug(db, "lifecycle")?.id).toBe(id);

    // Смена названия не меняет slug.
    updateEvent(db, id, { ...input, title: "Новое название", status: "published" }, undefined);
    const updated = getEventById(db, id)!;
    expect(updated.title).toBe("Новое название");
    expect(updated.slug).toBe("lifecycle");

    setEventStatus(db, id, "archived");
    expect(getPublishedEventBySlug(db, "lifecycle")).toBeNull();
    expect(getEventById(db, id)?.status).toBe("archived");
  });

  test("список на главной: только опубликованные с сегодняшней даты, ближайшие первыми", () => {
    const { db } = freshDb();
    const today = "2026-10-21";
    const later = makeEvent(db, { slug: "later", eventDate: "2026-12-01" });
    const todayLate = makeEvent(db, { slug: "today-late", eventDate: today, startTime: "18:00" });
    const todayEarly = makeEvent(db, { slug: "today-early", eventDate: today, startTime: "10:00" });
    const tomorrow = makeEvent(db, { slug: "tomorrow", eventDate: "2026-10-22" });
    makeEvent(db, { slug: "past", eventDate: "2026-10-20" });
    makeEvent(db, { slug: "draft", eventDate: "2026-11-01", status: "draft" });
    const archived = makeEvent(db, { slug: "archived", eventDate: "2026-11-01" });
    setEventStatus(db, archived.id, "archived");

    const list = listUpcomingPublishedEvents(db, today);
    expect(list.map((event) => event.id)).toEqual([todayEarly.id, todayLate.id, tomorrow.id, later.id]);

    const cards = list.map((event) => toEventCardView(event, today));
    expect(cards.map((card) => card.soonLabel)).toEqual(["Сегодня", "Сегодня", "Завтра", null]);
    expect(cards[3]).toMatchObject({ isoDate: "2026-12-01", day: "1", month: "декабря", weekday: "вторник" });

    // Удалённое мероприятие исчезает из списка.
    deleteEvent(db, later.id);
    expect(listUpcomingPublishedEvents(db, today).map((event) => event.id)).not.toContain(later.id);
    // Конец месяца и года для пометки «Завтра».
    expect(nextIsoDate("2026-12-31")).toBe("2027-01-01");
  });

  test("окончание мероприятия: подписи, проверка порядка и сохранение", () => {
    // Подписи для первого экрана, карточки и уведомлений.
    expect(formatEventSchedule({ event_date: "2026-10-31", start_time: "17:00" })).toEqual({
      facts: [{ label: "Дата", value: "31 октября 2026" }, { label: "Начало", value: "17:00" }],
      time: "17:00",
      line: "31 октября 2026 · 17:00",
    });
    expect(formatEventSchedule({ event_date: "2026-10-31", start_time: "17:00", end_time: "23:00" })).toEqual({
      facts: [{ label: "Дата", value: "31 октября 2026" }, { label: "Время", value: "17:00 – 23:00" }],
      time: "17:00 – 23:00",
      line: "31 октября 2026 · 17:00 – 23:00",
    });
    expect(formatEventSchedule({ event_date: "2026-10-31", start_time: "17:00", end_date: "2026-11-02", end_time: "12:00" })).toEqual({
      facts: [{ label: "Начало", value: "31 октября 2026, 17:00" }, { label: "Окончание", value: "2 ноября 2026, 12:00" }],
      time: "17:00 · до 2 ноября",
      line: "31 октября 2026, 17:00 — 2 ноября 2026, 12:00",
    });
    expect(formatEventSchedule({ event_date: "2026-12-31", start_time: "22:00", end_date: "2027-01-01", end_time: null }).facts[1]).toEqual({
      label: "Окончание",
      value: "1 января 2027",
    });

    const base = { title: "Велесова ночь", slug: "velesova-noch", eventDate: "2026-10-31", startTime: "17:00", shortDescription: "", locationText: "", status: "draft" };
    const issues = (input: Record<string, string>) => {
      const result = eventSchema.safeParse({ ...base, ...input });
      return result.success ? {} : Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
    };
    expect(issues({})).toEqual({});
    expect(issues({ endTime: "16:00" })).toHaveProperty("endTime", expect.stringContaining("после полуночи"));
    expect(issues({ endTime: "17:00" })).toHaveProperty("endTime");
    expect(issues({ endDate: "2026-10-30" })).toEqual({ endDate: "Дата окончания не может быть раньше даты начала." });
    expect(issues({ endDate: "2026-11-01", endTime: "02:00" })).toEqual({});
    expect(issues({ endTime: "25:00" })).toHaveProperty("endTime");
    expect(issues({ heroFit: "stretch" })).toHaveProperty("heroFit");
    // Окончание в тот же день хранится без даты.
    expect(eventSchema.parse({ ...base, endDate: "2026-10-31", endTime: "23:00" })).toMatchObject({ endDate: null, endTime: "23:00", heroFit: "cover" });

    const { db } = freshDb();
    const id = createEvent(db, eventSchema.parse({ ...base, endDate: "2026-11-01", endTime: "02:00", heroFit: "contain" }), null);
    expect(getEventById(db, id)).toMatchObject({ end_date: "2026-11-01", end_time: "02:00", hero_fit: "contain" });
    updateEvent(db, id, eventSchema.parse({ ...base }), undefined);
    expect(getEventById(db, id)).toMatchObject({ end_date: null, end_time: null, hero_fit: "cover" });
    // Ограничения в самой БД.
    expect(() => db.prepare("UPDATE events SET hero_fit = 'stretch' WHERE id = ?").run(id)).toThrow(/CHECK/);
    expect(() => db.prepare("UPDATE events SET end_time = '7pm' WHERE id = ?").run(id)).toThrow(/CHECK/);
  });

  test("slug уникален и проверяется", () => {
    const { db } = freshDb();
    makeEvent(db, { slug: "same-slug" });
    expect(() => makeEvent(db, { slug: "same-slug" })).toThrow(SlugTakenError);
    for (const slug of ["Bad Slug", "кириллица", "-start", "a", "x/../y"]) {
      expect(eventSchema.safeParse({ title: "x", slug, eventDate: "2026-11-01", startTime: "12:00", shortDescription: "", locationText: "", status: "draft" }).success).toBe(false);
    }
    expect(eventSchema.safeParse({ title: "x", slug: "ok-slug", eventDate: "2026-02-30", startTime: "12:00", shortDescription: "", locationText: "", status: "draft" }).success).toBe(false);
    expect(eventSchema.safeParse({ title: "x", slug: "ok-slug", eventDate: "2026-11-01", startTime: "12:00", shortDescription: "", locationText: "", status: "deleted" }).success).toBe(false);
  });
});

test.describe("услуги", () => {
  test("fixed, free и contact: цена определяется типом", () => {
    const { db } = freshDb();
    const { id: eventId } = makeEvent(db);
    const fixed = makeActivity(db, eventId, { title: "Фикс", pricingType: "fixed", price: "3 500,50" });
    const free = makeActivity(db, eventId, { title: "Бесплатно", pricingType: "free", price: "999" });
    const contact = makeActivity(db, eventId, { title: "Договорная", pricingType: "contact", price: "999", priceSuffix: "Уточнит администратор" });

    expect(getActivity(db, eventId, fixed)?.fixed_price_kopecks).toBe(350050);
    expect(getActivity(db, eventId, free)?.fixed_price_kopecks).toBe(0);
    expect(getActivity(db, eventId, contact)?.fixed_price_kopecks).toBeNull();

    // fixed без цены или с нулём не проходит валидацию.
    const base = { title: "x", shortDescription: "", longDescription: "", startTime: "", durationText: "", priceSuffix: "", details: "", isActive: true };
    expect(activitySchema.safeParse({ ...base, pricingType: "fixed", price: "" }).success).toBe(false);
    expect(activitySchema.safeParse({ ...base, pricingType: "fixed", price: "0" }).success).toBe(false);
    expect(activitySchema.safeParse({ ...base, pricingType: "fixed", price: "12.345" }).success).toBe(false);
    expect(activitySchema.safeParse({ ...base, pricingType: "gift", price: "" }).success).toBe(false);

    // Несогласованную цену не пропустит и CHECK в базе.
    expect(() =>
      db.prepare("INSERT INTO activities (event_id, title, pricing_type, fixed_price_kopecks) VALUES (?, 'x', 'contact', 100)").run(eventId),
    ).toThrow(/CHECK/);
  });

  test("изменение, выключение и порядок", () => {
    const { db } = freshDb();
    const { id: eventId } = makeEvent(db);
    const a = makeActivity(db, eventId, { title: "A" });
    const b = makeActivity(db, eventId, { title: "B", pricingType: "free" });
    const c = makeActivity(db, eventId, { title: "C", pricingType: "contact" });

    updateActivity(db, eventId, a, activityInput({ title: "A2", price: "4000", details: "Пункт 1\n\nПункт 2" }), undefined, { add: [], removeIds: [] });
    const updated = getActivity(db, eventId, a)!;
    expect(updated.title).toBe("A2");
    expect(updated.fixed_price_kopecks).toBe(400000);
    expect(JSON.parse(updated.details)).toEqual(["Пункт 1", "Пункт 2"]);

    moveActivity(db, eventId, c, "up");
    expect(listActivities(db, eventId).map((row) => row.title)).toEqual(["A2", "C", "B"]);
    expect(moveActivity(db, eventId, a, "up")).toBe(false);

    setActivityActive(db, eventId, b, false);
    expect(getPublicActivities(db, eventId).map((row) => row.title)).toEqual(["A2", "C"]);
    expect(listActivities(db, eventId)).toHaveLength(3);

    // Услугу чужого мероприятия изменить нельзя.
    const { id: otherEvent } = makeEvent(db);
    expect(setActivityActive(db, otherEvent, a, false)).toBe(false);
  });
});

test.describe("регистрация", () => {
  test("итог считает сервер для всех комбинаций услуг", () => {
    const { db } = freshDb();
    const { id: eventId } = makeEvent(db);
    const fixed = makeActivity(db, eventId, { title: "Гостиная", price: "3500" });
    const free = makeActivity(db, eventId, { title: "Костёр", pricingType: "free" });
    const contact = makeActivity(db, eventId, { title: "Проживание", pricingType: "contact" });

    const cases: [number[], number][] = [
      [[], 0],
      [[free], 0],
      [[fixed], 350000],
      [[fixed, free], 350000],
      [[fixed, contact], 350000],
    ];
    for (const [ids, total] of cases) {
      const registration = createRegistration(db, eventId, participant(ids));
      expect(registration.fixed_total_kopecks).toBe(total);
      expect(registration.activities).toHaveLength(ids.length);
      expect(registration.public_id).toMatch(/^[0-9a-f-]{36}$/);
    }
    expect(countRegistrations(db, eventId)).toBe(cases.length);
  });

  test("платное участие: обязательно входит в итог, фиксируется в регистрации", () => {
    const { db } = freshDb();
    const base = { title: "Велесова ночь", slug: "velesova-paid", eventDate: "2026-11-01", startTime: "17:00", shortDescription: "", locationText: "", status: "published" };
    const eventId = createEvent(db, eventSchema.parse({ ...base, price: "1 500" }), null);
    expect(getEventById(db, eventId)?.price_kopecks).toBe(150000);
    const paid = makeActivity(db, eventId, { title: "Баня", price: "6500,50" });
    const contact = makeActivity(db, eventId, { title: "Ночёвка", pricingType: "contact" });

    // Без услуг — только участие; с услугами — участие + фиксированные цены.
    const onlyEvent = createRegistration(db, eventId, participant([]));
    expect(onlyEvent).toMatchObject({ event_price_kopecks: 150000, fixed_total_kopecks: 150000 });
    const withServices = createRegistration(db, eventId, participant([paid, contact]));
    expect(withServices).toMatchObject({ event_price_kopecks: 150000, fixed_total_kopecks: 150000 + 650050 });
    expect(toReceipt(withServices, "Велесова ночь")).toMatchObject({ eventPriceKopecks: 150000, hasPaidActivities: true, totalKopecks: 800050 });

    // Изменение цены не меняет прошлые регистрации; бесплатное мероприятие — 0.
    updateEvent(db, eventId, eventSchema.parse({ ...base, price: "2000" }), undefined);
    expect(getRegistrationByPublicId(db, onlyEvent.public_id)).toMatchObject({ event_price_kopecks: 150000, fixed_total_kopecks: 150000 });
    expect(createRegistration(db, eventId, participant([])).fixed_total_kopecks).toBe(200000);
    updateEvent(db, eventId, eventSchema.parse({ ...base, price: "" }), undefined);
    expect(getEventById(db, eventId)?.price_kopecks).toBeNull();
    expect(createRegistration(db, eventId, participant([]))).toMatchObject({ event_price_kopecks: 0, fixed_total_kopecks: 0 });

    // Ввод администратора: рубли с копейками; ноль и мусор отклоняются.
    expect(eventSchema.parse({ ...base, price: "1500,50" }).priceKopecks).toBe(150050);
    expect(eventSchema.parse({ ...base }).priceKopecks).toBeNull();
    for (const price of ["0", "-100", "abc", "1.2.3"]) {
      expect(eventSchema.safeParse({ ...base, price }).success).toBe(false);
    }
    // Ограничения в БД: 0 не хранится (бесплатно — только NULL), дробных копеек нет.
    expect(() => db.prepare("UPDATE events SET price_kopecks = 0 WHERE id = ?").run(eventId)).toThrow(/CHECK/);
    expect(() => db.prepare("UPDATE events SET price_kopecks = 10.5 WHERE id = ?").run(eventId)).toThrow(/CHECK/);
  });

  test("блок «Дополнительно»: текст администратора сохраняется, пустой — блока нет", () => {
    const { db } = freshDb();
    const base = { title: "Липовая свадьба", slug: "lipovaya", eventDate: "2026-11-01", startTime: "17:00", shortDescription: "", locationText: "", status: "published" };
    const id = createEvent(db, eventSchema.parse({ ...base, extraInfo: "  Возьмите тёплую одежду.\nЗаезд с 16:00.  " }), null);
    expect(getEventById(db, id)?.extra_info).toBe("Возьмите тёплую одежду.\nЗаезд с 16:00.");
    updateEvent(db, id, eventSchema.parse({ ...base }), undefined);
    expect(getEventById(db, id)?.extra_info).toBe("");
    expect(eventSchema.safeParse({ ...base, extraInfo: "а".repeat(2001) }).success).toBe(false);
  });

  test("подробное описание (свиток «Подробнее»): длина не ограничена, пустое — свитка нет", () => {
    const { db } = freshDb();
    const base = { title: "Новогодняя ночь", slug: "novogodnyaya", eventDate: "2026-12-30", startTime: "16:00", shortDescription: "", locationText: "", status: "published" };
    const long = Array.from({ length: 500 }, (_, i) => `Абзац ${i + 1}: программа, меню и как добраться до «Рублёвки».`).join("\n\n");
    expect(long.length).toBeGreaterThan(25_000);
    const id = createEvent(db, eventSchema.parse({ ...base, longDescription: `  ${long}\n  ` }), null);
    expect(getEventById(db, id)?.long_description).toBe(long);
    updateEvent(db, id, eventSchema.parse({ ...base }), undefined);
    expect(getEventById(db, id)?.long_description).toBe("");
  });

  test("стоимость от клиента игнорируется", () => {
    const parsed = registrationSchema.parse({
      fullName: "Петров Пётр",
      phone: "+7 900 111-22-33",
      messenger: "@petrov",
      activityIds: [1, 1],
      fixedTotalKopecks: 1,
      price: 1,
    });
    expect(parsed).toEqual({ fullName: "Петров Пётр", phone: "+7 900 111-22-33", messenger: "@petrov", activityIds: [1] });
  });

  test("неверная, выключенная и чужая услуга отклоняются без частичной записи", () => {
    const { db } = freshDb();
    const { id: eventId } = makeEvent(db);
    const { id: otherEventId } = makeEvent(db);
    const own = makeActivity(db, eventId, { title: "Своя" });
    const foreign = makeActivity(db, otherEventId, { title: "Чужая" });
    const disabled = makeActivity(db, eventId, { title: "Выключенная", isActive: false });

    for (const ids of [[own, 999_999], [own, foreign], [disabled]]) {
      expect(() => createRegistration(db, eventId, participant(ids))).toThrow(RegistrationError);
    }
    expect(countRegistrations(db, eventId)).toBe(0);
    expect(db.prepare("SELECT COUNT(*) AS c FROM registration_activities").get()).toEqual({ c: 0 });

    setEventStatus(db, eventId, "draft");
    expect(() => createRegistration(db, eventId, participant([]))).toThrow(/закрыта/);
  });

  test("прошедшее мероприятие: регистрация закрыта, в день мероприятия — открыта", () => {
    const { db } = freshDb();
    const { id: eventId } = makeEvent(db, { eventDate: "2026-10-24" });
    const own = makeActivity(db, eventId, { title: "Своя" });

    let error: unknown;
    try {
      createRegistration(db, eventId, participant([own]), { today: "2026-10-25" });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(RegistrationError);
    expect(error).toMatchObject({ code: "event_closed", message: "Регистрация закрыта: мероприятие уже прошло." });
    expect(countRegistrations(db, eventId)).toBe(0);
    expect(db.prepare("SELECT COUNT(*) AS c FROM registration_activities").get()).toEqual({ c: 0 });

    // В сам день мероприятия и раньше — можно.
    expect(createRegistration(db, eventId, participant([own]), { today: "2026-10-24" }).fixed_total_kopecks).toBeGreaterThan(0);
    expect(createRegistration(db, eventId, participant([]), { today: "2026-10-01" }).fixed_total_kopecks).toBe(0);
    expect(countRegistrations(db, eventId)).toBe(2);

    expect(isPastEvent("2026-10-24", "2026-10-25")).toBe(true);
    expect(isPastEvent("2026-10-24", "2026-10-24")).toBe(false);
  });

  test("обязательны ФИО и телефон, мессенджер — по желанию", () => {
    const { db } = freshDb();
    const { id: eventId } = makeEvent(db);
    const phone = "+7 900 000-00-00";

    // 1. ФИО + телефон + мессенджер.
    const full = createRegistration(db, eventId, registrationSchema.parse({ fullName: "Иванов Иван", phone, messenger: "Telegram: @ivanov", activityIds: [] }));
    expect(full.messenger).toBe("Telegram: @ivanov");
    // 2. ФИО + телефон, мессенджер пустой, из пробелов или не передан — сохраняется NULL.
    for (const messenger of ["", "   ", undefined]) {
      const registration = createRegistration(db, eventId, registrationSchema.parse({ fullName: "Петров Пётр", phone, messenger, activityIds: [] }));
      expect(registration.messenger).toBeNull();
    }
    // 3–5. Нет ФИО, нет телефона, нет обоих.
    const errorsOf = (input: Record<string, unknown>) => {
      const result = registrationSchema.safeParse({ activityIds: [], ...input });
      return result.success ? [] : [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
    };
    expect(errorsOf({ phone })).toEqual(["fullName"]);
    expect(errorsOf({ fullName: "", phone })).toEqual(["fullName"]);
    expect(errorsOf({ fullName: "Иванов Иван" })).toEqual(["phone"]);
    expect(errorsOf({ fullName: "Иванов Иван", phone: "" })).toEqual(["phone"]);
    expect(errorsOf({}).sort()).toEqual(["fullName", "phone"]);
    expect(errorsOf({ fullName: " ", phone: " ", messenger: "" }).sort()).toEqual(["fullName", "phone"]);
    expect(countRegistrations(db, eventId)).toBe(4);
  });

  test("валидация данных участника", () => {
    const bad = [
      { fullName: " ", phone: "+7 900 000-00-00", messenger: "@x" },
      { fullName: "123", phone: "+7 900 000-00-00", messenger: "@abc" },
      { fullName: "Иван", phone: "12345", messenger: "@abc" },
      { fullName: "Иван", phone: "+7 900 000-00-00; DROP TABLE", messenger: "@abc" },
    ];
    for (const input of bad) expect(registrationSchema.safeParse({ ...input, activityIds: [] }).success).toBe(false);
    expect(registrationSchema.safeParse({ fullName: "Иван", phone: "+7 900 000-00-00", messenger: "@abc", activityIds: ["1"] }).success).toBe(false);
  });

  test("поиск по ФИО без учёта регистра и по цифрам телефона", () => {
    const { db } = freshDb();
    const { id: eventId } = makeEvent(db);
    createRegistration(db, eventId, registrationSchema.parse({ fullName: "Ёлкина Анна", phone: "+7 (927) 555-11-22", messenger: "@elkina", activityIds: [] }));
    createRegistration(db, eventId, participant());
    expect(listRegistrations(db, eventId, "елкина").map((r) => r.full_name)).toEqual(["Ёлкина Анна"]);
    expect(listRegistrations(db, eventId, "ИВАНОВ").map((r) => r.full_name)).toEqual(["Иванов Иван Иванович"]);
    expect(listRegistrations(db, eventId, "555-11").map((r) => r.full_name)).toEqual(["Ёлкина Анна"]);
    expect(listRegistrations(db, eventId, "' OR 1=1 --")).toHaveLength(0);
  });
});

test("snapshot: изменение и удаление услуги не меняет прошлую регистрацию", () => {
  const { db } = freshDb();
  const { id: eventId } = makeEvent(db);
  const activityId = makeActivity(db, eventId, { title: "Литературная гостиная", price: "3500" });
  const registration = createRegistration(db, eventId, participant([activityId]));

  updateActivity(db, eventId, activityId, activityInput({ title: "Литературный вечер", price: "5000" }), undefined, { add: [], removeIds: [] });
  const after = getRegistrationByPublicId(db, registration.public_id)!;
  expect(after.fixed_total_kopecks).toBe(350000);
  expect(after.activities[0]).toMatchObject({
    activity_id: activityId,
    activity_title_snapshot: "Литературная гостиная",
    fixed_price_kopecks_snapshot: 350000,
    pricing_type_snapshot: "fixed",
  });

  // Новая регистрация получает уже новую цену.
  expect(createRegistration(db, eventId, participant([activityId])).fixed_total_kopecks).toBe(500000);

  deleteActivity(db, eventId, activityId);
  const afterDelete = getRegistrationByPublicId(db, registration.public_id)!;
  expect(afterDelete.activities[0]).toMatchObject({ activity_id: null, activity_title_snapshot: "Литературная гостиная" });
  expect(afterDelete.fixed_total_kopecks).toBe(350000);
});

test("очистка регистраций мероприятия не затрагивает другие данные", () => {
  const { db } = freshDb();
  const { id: eventId } = makeEvent(db);
  const { id: otherId } = makeEvent(db);
  const activityId = makeActivity(db, eventId);
  const otherActivity = makeActivity(db, otherId);
  createRegistration(db, eventId, participant([activityId]));
  createRegistration(db, eventId, participant([]));
  createRegistration(db, otherId, participant([otherActivity]));

  expect(deleteRegistrationsForEvent(db, eventId)).toBe(2);
  expect(countRegistrations(db, eventId)).toBe(0);
  expect(countRegistrations(db, otherId)).toBe(1);
  expect(db.prepare("SELECT COUNT(*) AS c FROM registration_activities").get()).toEqual({ c: 1 });
  expect(getEventById(db, eventId)).not.toBeNull();
  expect(listActivities(db, eventId)).toHaveLength(1);
  expect(listGallery(db, [activityId])).toHaveLength(0);
});
