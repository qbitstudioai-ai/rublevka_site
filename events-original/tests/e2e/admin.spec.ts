import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { formatEventDate, todayIso } from "@/lib/format";
import { formatRub } from "@/lib/money";
import { E2E_ADMIN, E2E_TELEGRAM } from "../test-env";
import {
  collapseAssistant,
  expectNoHorizontalOverflow,
  fillParticipant,
  imageFixture,
  login,
  newEventPage,
  readDb,
  shot,
  telegramRequests,
  uniqueName,
  uploadFileExists,
  waitForImages,
} from "./helpers";

test.beforeEach(async ({ context }) => collapseAssistant(context));

/** Скачивает Excel по кнопке и читает лист «Участники». */
async function downloadExcel(page: Page) {
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Скачать Excel" }).click()]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile((await download.path())!);
  const sheet = workbook.getWorksheet("Участники")!;
  const rows = [];
  for (let index = 1; index <= sheet.rowCount; index += 1) rows.push((sheet.getRow(index).values as unknown[]).slice(1));
  return { fileName: download.suggestedFilename(), sheet, rows };
}

test.describe("доступ к админпанели", () => {
  test("закрыта без сессии; неверный пароль не авторизует; вход и выход", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Сценарий проверяется на desktop");
    for (const url of ["/meropriyatiya/admin", "/meropriyatiya/admin/settings", "/meropriyatiya/admin/events/new", "/meropriyatiya/admin/events/1"]) {
      await page.goto(url);
      await expect(page).toHaveURL(/\/admin\/login$/);
    }

    await page.getByLabel("Логин").fill(E2E_ADMIN.username);
    await page.getByLabel("Пароль").fill("wrong-password-123");
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(page.getByText("Неверный логин или пароль.")).toBeVisible();
    await page.goto("/meropriyatiya/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);

    await page.screenshot({ path: shot("v3-admin-01-login.png") });
    await login(page);
    const cookie = (await page.context().cookies()).find((item) => item.name === "rublevka_events_admin");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    expect(cookie?.secure).toBe(true);

    // Подделанная cookie не даёт доступа.
    await page.context().addCookies([{ ...cookie!, value: `${cookie!.value.split(".")[0]}.forged` }]);
    await page.goto("/meropriyatiya/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);

    await login(page);
    await page.getByRole("button", { name: "Выйти" }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);
    await page.goto("/meropriyatiya/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});

/** Создаёт мероприятие через форму и возвращает его id и slug. */
async function createEvent(page: Page, title: string, eventDate?: string) {
  await page.goto("/meropriyatiya/admin/events/new");
  await page.getByLabel("Название мероприятия").fill(title);
  if (eventDate) await page.getByLabel("Дата начала").fill(eventDate);
  const slug = await page.getByLabel("Адрес страницы (slug)").inputValue();
  expect(slug).toMatch(/^[a-z0-9-]+$/);
  await page.getByLabel("Главная фотография").setInputFiles(await imageFixture("hero.jpg", "#5a8a5a", 2600, 1600));
  await page.getByRole("button", { name: "Создать мероприятие" }).click();
  await expect(page).toHaveURL(/\/admin\/events\/\d+\?created=1/);
  const id = Number(/events\/(\d+)/.exec(page.url())![1]);
  return { id, slug };
}

async function addActivity(page: Page, eventId: number, data: { title: string; type: "fixed" | "free" | "contact"; price?: string; photo?: string }) {
  await page.goto(`/meropriyatiya/admin/events/${eventId}/activities/new`);
  await page.getByLabel("Название").fill(data.title);
  await page.getByLabel("Краткое описание на карточке").fill(`Описание: ${data.title}`);
  const label = { fixed: "Фиксированная цена", free: "Бесплатно", contact: "По согласованию" }[data.type];
  await page.getByRole("radio", { name: new RegExp(label) }).check();
  if (data.type === "fixed") {
    await page.getByLabel("Цена, ₽").fill(data.price ?? "1000");
  } else {
    // Для free и contact поле цены скрыто.
    await expect(page.getByLabel("Цена, ₽")).toHaveCount(0);
  }
  if (data.photo) await page.getByLabel("Фото карточки").setInputFiles(data.photo);
  await page.getByRole("button", { name: "Добавить услугу" }).click();
  await expect(page).toHaveURL(new RegExp(`/meropriyatiya/admin/events/${eventId}\\?activitySaved=1`));
}

test.describe("управление мероприятием", () => {
  test.describe.configure({ mode: "serial" });

  test("создание, услуги, публикация, регистрация, snapshot, Excel, архив и очистка", async ({ page, browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Сценарий проверяется на desktop");
    test.setTimeout(240_000);
    await login(page);

    const title = `Осенний пикник ${Date.now().toString(36)}`;
    const { id, slug } = await createEvent(page, title);
    await expect(page.getByTestId("public-url")).toContainText(`/meropriyatiya/event/${slug}`);
    await expect(page.getByText("Черновик").first()).toBeVisible();

    // Черновик публично недоступен.
    const publicPage = await page.context().newPage();
    expect((await publicPage.goto(`/meropriyatiya/event/${slug}`))?.status()).toBe(404);

    // Без регистраций выгружать нечего — кнопка неактивна и это объяснено.
    await expect(page.getByRole("button", { name: "Скачать Excel" })).toBeDisabled();
    await expect(page.getByText("Регистраций пока нет — выгружать нечего.")).toBeVisible();

    // Услуги трёх типов.
    const cardPhoto = await imageFixture("card.png", "#c96f4a", 1600, 1000);
    await addActivity(page, id, { title: "Мастер-класс", type: "fixed", price: "3500", photo: cardPhoto });
    await addActivity(page, id, { title: "Прогулка", type: "free" });
    await addActivity(page, id, { title: "Ночёвка", type: "contact" });
    const rows = page.getByTestId("admin-activity");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("3 500 ₽");
    await expect(rows.nth(1)).toContainText("Бесплатно");
    await expect(rows.nth(2)).toContainText("Стоимость уточнит администратор");

    // Порядок: «Ночёвка» выше «Прогулки».
    await page.getByRole("button", { name: "Выше: Ночёвка" }).click();
    await expect(rows.nth(1)).toContainText("Ночёвка");

    // Выключение скрывает услугу публично.
    await rows.nth(2).getByRole("button", { name: "Выключить" }).click();
    await expect(rows.nth(2)).toContainText("Выключена");

    await page.screenshot({ path: shot("v3-admin-03-event-edit.png") });
    await page.locator("#activities").screenshot({ path: shot("v3-admin-04-activities.png") });

    // Публикация.
    await page.getByRole("button", { name: "Опубликовать" }).click();
    await expect(page.getByText("Опубликовано").first()).toBeVisible();
    expect((await publicPage.goto(`/meropriyatiya/event/${slug}`))?.status()).toBe(200);
    await expect(publicPage.locator(".activity-card h3")).toHaveText(["Мастер-класс", "Ночёвка"]);
    await expect(publicPage.locator(".hero-photo img")).toHaveAttribute("src", /^\/meropriyatiya\/media\/[0-9a-f-]{36}\.webp$/);
    const heroSrc = (await publicPage.locator(".hero-photo img").getAttribute("src"))!;
    const cardSrc = (await publicPage.locator(".activity-card img").first().getAttribute("src"))!;
    expect(uploadFileExists(heroSrc)).toBe(true);
    expect(uploadFileExists(cardSrc)).toBe(true);

    // Редактирование названия не меняет slug и ссылку.
    const newTitle = `${title} (обновлено)`;
    await page.locator("#main").getByLabel("Название мероприятия").fill(newTitle);
    await page.getByRole("button", { name: "Сохранить изменения" }).click();
    await expect(page.getByText("Изменения сохранены.")).toBeVisible();
    await expect(page.getByTestId("public-url")).toContainText(`/meropriyatiya/event/${slug}`);
    await publicPage.goto(`/meropriyatiya/event/${slug}`);
    await expect(publicPage.getByRole("heading", { level: 1 })).toContainText(newTitle);

    // Регистрация участника на опубликованное мероприятие.
    const guest = uniqueName("Админ");
    await fillParticipant(publicPage, guest);
    await publicPage.getByLabel("ФИО").fill(guest);
    await publicPage.getByLabel("Телефон").fill("+7 927 123-45-67");
    await publicPage.getByRole("checkbox", { name: /Мастер-класс/ }).check();
    await publicPage.getByRole("checkbox", { name: /Ночёвка/ }).check();
    await publicPage.getByRole("button", { name: "Зарегистрироваться" }).click();
    await expect(publicPage.getByTestId("receipt-total")).toHaveText("3 500 ₽");

    // Второй участник — без мессенджера и без услуг.
    const guestWithoutMessenger = uniqueName("Без мессенджера");
    await publicPage.goto(`/meropriyatiya/event/${slug}`);
    await fillParticipant(publicPage, guestWithoutMessenger, null);
    await publicPage.getByRole("button", { name: "Зарегистрироваться" }).click();
    await expect(publicPage.getByRole("heading", { name: "Регистрация завершена" })).toBeVisible();

    // Регистрации в админке, поиск по ФИО и телефону.
    await page.goto(`/meropriyatiya/admin/events/${id}#registrations`);
    const registrations = page.getByTestId("admin-registration");
    await expect(registrations).toHaveCount(2);
    const first = registrations.filter({ hasText: guest });
    await expect(first).toContainText("Мастер-класс, Ночёвка");
    await expect(first).toContainText("3 500 ₽");
    const second = registrations.filter({ hasText: guestWithoutMessenger });
    await expect(second.locator('td[data-label="Мессенджер"]')).toHaveText("—");
    await expect(second.locator('td[data-label="Услуги"]')).toHaveText("—");
    await page.getByLabel("Поиск по ФИО или телефону").fill(guest.split(" ")[1].toLowerCase());
    await page.getByRole("button", { name: "Найти" }).click();
    await expect(registrations).toHaveCount(1);
    await page.getByLabel("Поиск по ФИО или телефону").fill("123-45");
    await page.getByRole("button", { name: "Найти" }).click();
    await expect(registrations).toHaveCount(1);
    await page.getByLabel("Поиск по ФИО или телефону").fill("Несуществующий");
    await page.getByRole("button", { name: "Найти" }).click();
    await expect(registrations).toHaveCount(0);
    // Поиск не ограничивает Excel: выгружается полный список (заголовок + 2 участника).
    const searched = await downloadExcel(page);
    expect(searched.rows).toHaveLength(3);
    await page.goto(`/meropriyatiya/admin/events/${id}#registrations`);
    await page.locator("#registrations").screenshot({ path: shot("v3-admin-05-registrations.png") });

    // Snapshot: меняем цену и название услуги — старая регистрация не меняется.
    await page.getByTestId("admin-activity").filter({ hasText: "Мастер-класс" }).getByRole("link", { name: "Изменить" }).click();
    await page.screenshot({ path: shot("v3-admin-06-activity-form.png"), fullPage: true });
    await page.getByLabel("Название").fill("Большой мастер-класс");
    await page.getByLabel("Цена, ₽").fill("5000");
    await page.getByRole("button", { name: "Сохранить услугу" }).click();
    await expect(page.getByTestId("admin-activity").first()).toContainText("5 000 ₽");

    await page.goto(`/meropriyatiya/admin/events/${id}#registrations`);
    await page.getByRole("link", { name: guest }).click();
    await expect(page.getByTestId("registration-total")).toHaveText("3 500 ₽");
    await expect(page.getByTestId("snapshot-row").first()).toContainText("Мастер-класс");
    await expect(page.getByTestId("snapshot-row").first()).not.toContainText("Большой");
    await expect(page.getByTestId("snapshot-row").first()).toContainText("3 500 ₽");
    await page.screenshot({ path: shot("v3-admin-07-registration-details.png"), fullPage: true });

    await page.goto(`/meropriyatiya/admin/events/${id}#registrations`);
    await page.getByRole("link", { name: guestWithoutMessenger }).click();
    await expect(page.locator(".a-details")).toContainText("Не указан");

    // Excel: динамические колонки «Услуга N», snapshot-названия, числовая сумма и дата.
    await page.goto(`/meropriyatiya/admin/events/${id}#registrations`);
    const excel = await downloadExcel(page);
    const [{ event_date: eventDate }] = readDb<{ event_date: string }>("SELECT event_date FROM events WHERE id = ?", id);
    expect(excel.fileName).toBe(`${slug}_uchastniki_${eventDate}.xlsx`);
    const [header, firstRow, secondRow] = excel.rows;
    expect(header).toEqual(["Дата регистрации", "Название мероприятия", "ФИО", "Телефон", "Мессенджер", "Услуга 1", "Услуга 2", "Фиксированная сумма"]);
    // Название мероприятия — текущее, после переименования.
    expect(firstRow.slice(1, 8)).toEqual([newTitle, guest, "+7 927 123-45-67", "Telegram: @ivanov", "Мастер-класс", "Ночёвка", 3500]);
    expect(firstRow[0]).toBeInstanceOf(Date);
    expect(secondRow[1]).toBe(newTitle);
    expect(secondRow[2]).toBe(guestWithoutMessenger);
    expect(secondRow[4] ?? null).toBeNull();
    expect(secondRow[7]).toBe(0);
    expect(excel.sheet.getRow(2).getCell(8).numFmt).toBe('#,##0 "₽"');

    // Без сессии администратора файл не выдаётся.
    const anonymous = await browser.newContext();
    const denied = await anonymous.request.get(`/meropriyatiya/admin/events/${id}/export`, { maxRedirects: 0 });
    expect(denied.status()).toBe(303);
    expect(denied.headers()["location"]).toContain("/meropriyatiya/admin/login");
    expect(denied.headers()["content-type"] ?? "").not.toContain("spreadsheet");
    await anonymous.close();

    // Страница оплаты по-прежнему показывает сумму из регистрации.
    const [{ public_id: publicId }] = readDb<{ public_id: string }>("SELECT public_id FROM registrations WHERE full_name = ?", guest);
    await publicPage.goto(`/meropriyatiya/payment/${publicId}`);
    await expect(publicPage.getByTestId("payment-amount")).toHaveText("3 500 ₽");

    // Архив: публично недоступно, данные сохранены.
    await page.goto(`/meropriyatiya/admin/events/${id}`);
    await page.getByRole("button", { name: "Архивировать" }).click();
    await expect(page.getByText("В архиве").first()).toBeVisible();
    expect((await publicPage.goto(`/meropriyatiya/event/${slug}`))?.status()).toBe(404);
    await page.goto("/meropriyatiya/admin");
    await expect(page.locator(".a-event-row").filter({ hasText: newTitle }).locator(".a-event-count strong")).toHaveText("2");
    await page.screenshot({ path: shot("v3-admin-02-events.png"), fullPage: true });

    // Удаление всех регистраций — только после подтверждения.
    await page.goto(`/meropriyatiya/admin/events/${id}#cleanup`);
    const deleteRegistrations = page.getByRole("button", { name: "Удалить регистрации (2)" });
    await expect(deleteRegistrations).toBeDisabled();
    await page.getByLabel(/Я понимаю/).check();
    await page.locator("#cleanup").screenshot({ path: shot("v3-admin-08-cleanup.png") });
    await deleteRegistrations.click();
    await expect(page.getByText("Удалено регистраций: 2")).toBeVisible();
    expect(readDb("SELECT id FROM registrations WHERE public_id = ?", publicId)).toHaveLength(0);
    expect(readDb("SELECT ra.id FROM registration_activities ra LEFT JOIN registrations r ON r.id = ra.registration_id WHERE r.id IS NULL")).toHaveLength(0);
    await page.goto(`/meropriyatiya/admin/events/${id}`);
    await expect(page.getByTestId("admin-activity")).toHaveCount(3);

    // Полное удаление: кнопка неактивна, пока название не введено точно.
    const deleteEvent = page.getByRole("button", { name: "Удалить мероприятие навсегда" });
    await expect(deleteEvent).toBeDisabled();
    await page.getByLabel(/Для подтверждения введите название/).fill("неправильно");
    await expect(deleteEvent).toBeDisabled();
    await page.getByLabel(/Для подтверждения введите название/).fill(newTitle);
    await deleteEvent.click();
    await expect(page).toHaveURL(/\/admin\?deleted=/);
    await expect(page.getByText(/удалено вместе с услугами/)).toBeVisible();

    expect(readDb("SELECT id FROM events WHERE id = ?", id)).toHaveLength(0);
    expect(readDb("SELECT id FROM activities WHERE event_id = ?", id)).toHaveLength(0);
    expect(uploadFileExists(heroSrc)).toBe(false);
    expect(uploadFileExists(cardSrc)).toBe(false);
    expect((await publicPage.goto(`/meropriyatiya/payment/${publicId}`))?.status()).toBe(404);
  });

  test("главная: список мероприятий следует за публикацией, архивом и удалением", async ({ page, browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Сценарий проверяется на desktop");
    test.setTimeout(180_000);
    await login(page);

    const suffix = Date.now().toString(36);
    const soonTitle = `Вечер у костра ${suffix}`;
    const laterTitle = `Зимняя рыбалка ${suffix}`;
    const laterDate = new Date(Date.now() + 40 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    // Дата по умолчанию в форме — сегодня.
    const soon = await createEvent(page, soonTitle);
    await page.getByRole("button", { name: "Опубликовать" }).click();
    await expect(page.getByText("Опубликовано").first()).toBeVisible();
    const later = await createEvent(page, laterTitle, laterDate);

    // Черновик в списке не показывается.
    const home = await page.context().newPage();
    await home.goto("/meropriyatiya");
    const card = (title: string) => home.getByTestId("event-card").filter({ hasText: title });
    await expect(card(soonTitle)).toBeVisible();
    await expect(card(soonTitle)).toContainText("Сегодня");
    await expect(card(laterTitle)).toHaveCount(0);

    // Публикация — мероприятие появляется; ближайшие идут первыми.
    await page.getByRole("button", { name: "Опубликовать" }).click();
    await expect(page.getByText("Опубликовано").first()).toBeVisible();
    await home.reload();
    await expect(card(laterTitle)).toBeVisible();
    const titles = await home.locator(".event-card h2").allTextContents();
    expect(titles.indexOf(soonTitle)).toBeLessThan(titles.indexOf(laterTitle));
    await waitForImages(home);
    await home.screenshot({ path: shot("v7-desktop-home-01-list.png"), fullPage: true });

    const mobile = await newEventPage(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await mobile.goto("/meropriyatiya");
    await waitForImages(mobile);
    await expectNoHorizontalOverflow(mobile);
    await mobile.screenshot({ path: shot("v7-mobile-home-01-first-screen.png") });
    await mobile.screenshot({ path: shot("v7-mobile-home-02-list.png"), fullPage: true });
    await mobile.close();

    // Нажатие на карточку (не только на кнопку) ведёт на анкету мероприятия.
    await card(laterTitle).click({ position: { x: 40, y: 40 } });
    await expect(home).toHaveURL(new RegExp(`/meropriyatiya/event/${later.slug}$`));
    await expect(home.getByRole("heading", { level: 1 })).toContainText(laterTitle);

    // Архив — мероприятие пропадает из списка.
    await page.goto(`/meropriyatiya/admin/events/${soon.id}`);
    await page.getByRole("button", { name: "Архивировать" }).click();
    await expect(page.getByText("В архиве").first()).toBeVisible();
    await home.goto("/meropriyatiya");
    await expect(card(laterTitle)).toBeVisible();
    await expect(card(soonTitle)).toHaveCount(0);

    // Удаление — тоже.
    await page.goto(`/meropriyatiya/admin/events/${later.id}#cleanup`);
    await page.getByLabel(/Для подтверждения введите название/).fill(laterTitle);
    await page.getByRole("button", { name: "Удалить мероприятие навсегда" }).click();
    await expect(page).toHaveURL(/\/admin\?deleted=/);
    await home.reload();
    await expect(card(laterTitle)).toHaveCount(0);
  });

  test("прошедшее мероприятие: «Регистрация закрыта», сервер отклоняет открытую ранее анкету", async ({ page, browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Сценарий проверяется на desktop");
    test.setTimeout(180_000);
    await login(page);

    const title = `Прошедший вечер ${Date.now().toString(36)}`;
    const { id, slug } = await createEvent(page, title);
    await page.getByRole("button", { name: "Опубликовать" }).click();
    await expect(page.getByText("Опубликовано").first()).toBeVisible();
    await expect(page.getByTestId("event-past-hint")).toHaveCount(0);

    // Гость открыл анкету, пока мероприятие ещё не прошло, и заполнил её.
    const stale = await page.context().newPage();
    await stale.goto(`/meropriyatiya/event/${slug}`);
    const guest = uniqueName("Опоздавший");
    await fillParticipant(stale, guest);

    // Тем временем дата мероприятия стала вчерашней.
    const yesterday = new Date(`${todayIso()}T00:00:00Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayIso = yesterday.toISOString().slice(0, 10);
    await page.locator("#main").getByLabel("Дата начала").fill(yesterdayIso);
    await page.getByRole("button", { name: "Сохранить изменения" }).click();
    await expect(page.getByTestId("event-past-hint")).toBeVisible();

    // Отправка из «старой» вкладки отклоняется сервером, запись не создаётся.
    await stale.getByRole("button", { name: "Зарегистрироваться" }).click();
    await expect(stale.getByText("Регистрация закрыта: мероприятие уже прошло.")).toBeVisible();
    await expect(stale.getByRole("heading", { name: "Регистрация завершена" })).toHaveCount(0);
    expect(readDb("SELECT id FROM registrations WHERE full_name = ?", guest)).toHaveLength(0);

    // По ссылке — «Регистрация закрыта» вместо анкеты, путь к списку мероприятий.
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const closed = await newEventPage(browser, { viewport });
      expect((await closed.goto(`/meropriyatiya/event/${slug}`))?.status()).toBe(200);
      await expect(closed.getByRole("heading", { level: 1 })).toContainText("Регистрация закрыта");
      const notice = closed.getByTestId("registration-closed");
      await expect(notice.getByRole("heading", { name: "Мероприятие уже прошло" })).toBeVisible();
      await expect(notice).toContainText(`«${title}» состоялось ${formatEventDate(yesterdayIso)}.`);
      await expect(closed.getByRole("form", { name: "Анкета регистрации участника" })).toHaveCount(0);
      await expect(closed.getByLabel("ФИО")).toHaveCount(0);
      await expectNoHorizontalOverflow(closed);
      await waitForImages(closed);
      await closed.screenshot({ path: shot(`v9-${viewport.width > 700 ? "desktop" : "mobile"}-registration-closed.png`) });
      await notice.getByRole("link", { name: "Ближайшие мероприятия" }).click();
      await expect(closed).toHaveURL(/\/meropriyatiya$/);
      await expect(closed.getByTestId("event-card").filter({ hasText: title })).toHaveCount(0);
      await closed.close();
    }

    // Уборка: тестовое мероприятие не нужно другим тестам.
    await page.goto(`/meropriyatiya/admin/events/${id}#cleanup`);
    await page.getByLabel(/Для подтверждения введите название/).fill(title);
    await page.getByRole("button", { name: "Удалить мероприятие навсегда" }).click();
    await expect(page).toHaveURL(/\/admin\?deleted=/);
  });

  test("окончание мероприятия и вертикальная афиша целиком", async ({ page, browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Сценарий проверяется на desktop");
    test.setTimeout(180_000);
    await login(page);

    // Тестовая афиша 1080 × 1920 (9 : 16, как сторис) с надписями у самых краёв: при обрезке они бы пропали.
    const poster = path.join(process.cwd(), ".e2e-data", "fixtures", "poster.png");
    fs.mkdirSync(path.dirname(poster), { recursive: true });
    await sharp(
      Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
        <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b1a3a"/><stop offset="1" stop-color="#8a3b1c"/></linearGradient></defs>
        <rect width="1080" height="1920" fill="url(#g)"/>
        <text x="540" y="120" font-size="96" font-family="Georgia" fill="#f4ccbb" text-anchor="middle">ВЕРХ АФИШИ</text>
        <circle cx="540" cy="960" r="260" fill="#f4ccbb" opacity="0.85"/>
        <text x="540" y="1860" font-size="96" font-family="Georgia" fill="#f4ccbb" text-anchor="middle">НИЗ АФИШИ</text>
      </svg>`),
    )
      .png()
      .toFile(poster);

    const title = `Велесова ночь ${Date.now().toString(36)}`;
    await page.goto("/meropriyatiya/admin/events/new");
    await page.getByLabel("Название мероприятия").fill(title);
    const slug = await page.getByLabel("Адрес страницы (slug)").inputValue();
    await page.getByLabel("Время начала").fill("17:00");

    // Окончание раньше начала в тот же день — понятная ошибка у поля.
    await page.getByLabel("Время окончания (необязательно)").fill("16:00");
    await page.getByRole("button", { name: "Создать мероприятие" }).click();
    await expect(page.locator("#endTime-error")).toContainText("после полуночи");

    // Окончание на следующий день в 02:00.
    const startIso = await page.getByLabel("Дата начала").inputValue();
    const next = new Date(`${startIso}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const endIso = next.toISOString().slice(0, 10);
    await page.getByLabel("Дата окончания (необязательно)").fill(endIso);
    await page.getByLabel("Время окончания (необязательно)").fill("02:00");

    // Вертикальное фото: виден размер, режим сам переключается на «Афиша».
    await expect(page.getByRole("radio", { name: /Заполнить рамку/ })).toBeChecked();
    await page.getByLabel("Подпись на фотографии (место)").fill("Рублёвка · Краснослободск");
    await page.getByLabel("Главная фотография").setInputFiles(poster);
    await expect(page.getByTestId("hero-size")).toHaveText("Выбрано фото 1080 × 1920 px — вертикальное, включён режим «Афиша».");
    await expect(page.getByRole("radio", { name: /Афиша/ })).toBeChecked();
    await page.getByRole("button", { name: "Создать мероприятие" }).click();
    await expect(page).toHaveURL(/\/admin\/events\/\d+\?created=1/);
    const id = Number(/events\/(\d+)/.exec(page.url())![1]);
    await page.getByRole("button", { name: "Опубликовать" }).click();
    await expect(page.getByText("Опубликовано").first()).toBeVisible();
    const [row] = readDb<{ end_date: string; end_time: string; hero_fit: string }>("SELECT end_date, end_time, hero_fit FROM events WHERE id = ?", id);
    expect(row).toEqual({ end_date: endIso, end_time: "02:00", hero_fit: "contain" });

    // Список в админке показывает период.
    await page.goto("/meropriyatiya/admin");
    await expect(page.locator(".a-event-row").filter({ hasText: title })).toContainText(`${formatEventDate(startIso)}, 17:00 — ${formatEventDate(endIso)}, 02:00`);

    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const device = viewport.width > 700 ? "desktop" : "mobile";
      const visitor = await newEventPage(browser, { viewport });
      await visitor.goto(`/meropriyatiya/event/${slug}`);
      const facts = visitor.locator(".event-facts");
      await expect(facts).toContainText(`Начало${formatEventDate(startIso)}, 17:00`);
      await expect(facts).toContainText(`Окончание${formatEventDate(endIso)}, 02:00`);
      // Афиша целиком, без обрезки: рамка повторяет пропорции файла 9 : 16, размытой копии нет.
      await expect(visitor.locator(".hero.has-poster")).toHaveCount(1);
      await expect(visitor.locator(".hero-photo")).toHaveCount(0);
      const posterImage = visitor.getByTestId("hero-poster").locator(".poster-image");
      await expect(posterImage).toHaveAttribute("alt", `Афиша мероприятия «${title}»`);
      await waitForImages(visitor);
      const box = (await posterImage.boundingBox())!;
      expect(box.height / box.width).toBeCloseTo(1920 / 1080, 1);
      expect(box.height).toBeGreaterThan(viewport.width > 700 ? 600 : 400);
      // Листок с датой и подпись места рядом с афишей.
      await expect(visitor.locator(".poster-leaf")).toHaveAttribute("aria-hidden", "true");
      await expect(visitor.locator(".poster-caption")).toHaveText("Рублёвка · Краснослободск");
      await expectNoHorizontalOverflow(visitor);
      await visitor.screenshot({ path: shot(`v13-${device}-poster-event.png`) });
      if (device === "desktop") {
        // Афиша выходит за нижний край шапки, но не наезжает на поля анкеты.
        const heroBottom = (await visitor.locator(".hero").boundingBox())!;
        const sheet = (await visitor.locator(".hero-poster .poster-sheet").boundingBox())!;
        expect(sheet.y + sheet.height).toBeGreaterThan(heroBottom.y + heroBottom.height);
        const field = (await visitor.getByLabel("ФИО").boundingBox())!;
        expect(field.y).toBeGreaterThan(sheet.y + sheet.height);
      } else {
        // На телефоне первый экран показывает афишу целиком и кнопку «Открыть афишу».
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
        await expect(visitor.getByRole("button", { name: "Открыть афишу" })).toBeInViewport();
      }

      // Афиша на весь экран: открывается кнопкой, закрывается крестиком и клавишей Escape.
      await visitor.getByRole("button", { name: "Открыть афишу" }).click();
      const dialog = visitor.getByRole("dialog", { name: `Афиша «${title}»` });
      await expect(dialog).toBeVisible();
      const big = (await dialog.locator(".poster-dialog-image").boundingBox())!;
      expect(big.height).toBeGreaterThan(box.height);
      await visitor.screenshot({ path: shot(`v13-${device}-poster-dialog.png`) });
      await dialog.getByRole("button", { name: "Закрыть афишу" }).click();
      await expect(dialog).toBeHidden();
      await visitor.getByRole("button", { name: "Открыть афишу" }).click();
      await expect(dialog).toBeVisible();
      await visitor.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(visitor.getByRole("button", { name: "Открыть афишу" })).toBeFocused();

      await visitor.goto("/meropriyatiya");
      const card = visitor.getByTestId("event-card").filter({ hasText: title });
      // Отступ между днём недели и временем задают стили, в тексте пробела может не быть.
      await expect(card).toContainText(new RegExp(`,\\s*17:00 · до ${formatEventDate(endIso).replace(/ \d{4}$/, "")}`));
      // В карточке — та же афиша целиком на подложке.
      await card.scrollIntoViewIfNeeded();
      await waitForImages(visitor);
      const cardPoster = (await card.locator(".event-card-poster .poster-image").boundingBox())!;
      expect(cardPoster.height / cardPoster.width).toBeCloseTo(1920 / 1080, 1);
      await expectNoHorizontalOverflow(visitor);
      await card.screenshot({ path: shot(`v13-${device}-poster-card.png`) });
      await visitor.close();
    }
    await page.goto(`/meropriyatiya/admin/events/${id}`);
    await page.screenshot({ path: shot("v13-admin-poster.png"), fullPage: true });

    // Уборка.
    await page.goto(`/meropriyatiya/admin/events/${id}#cleanup`);
    await page.getByLabel(/Для подтверждения введите название/).fill(title);
    await page.getByRole("button", { name: "Удалить мероприятие навсегда" }).click();
    await expect(page).toHaveURL(/\/admin\?deleted=/);
  });

  test("платное участие: обязательно в итоге, услуги — по желанию", async ({ page, browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Сценарий проверяется на desktop");
    test.setTimeout(180_000);
    await login(page);
    const rub = (rubles: number) => formatRub(rubles * 100);

    const title = `Платный вечер ${Date.now().toString(36)}`;
    const { id, slug } = await createEvent(page, title);
    const priceField = page.locator("#main").getByLabel("Стоимость участия, ₽ (необязательно)");
    await priceField.fill("0");
    await page.getByRole("button", { name: "Сохранить изменения" }).click();
    await expect(page.locator("#price-error")).toContainText("больше нуля");
    await priceField.fill("1500");
    await page.getByRole("button", { name: "Сохранить изменения" }).click();
    await expect(page.locator("#main").getByLabel("Стоимость участия, ₽ (необязательно)")).toHaveValue("1500");
    await addActivity(page, id, { title: "Баня", type: "fixed", price: "3500" });
    await page.getByRole("button", { name: "Опубликовать" }).click();
    await expect(page.getByText("Опубликовано").first()).toBeVisible();

    // Стоимость видна в списке и на первом экране анкеты.
    const visitor = await newEventPage(browser, { viewport: { width: 1440, height: 1000 } });
    await visitor.goto("/meropriyatiya");
    await expect(visitor.getByTestId("event-card").filter({ hasText: title })).toContainText(`Участие — ${rub(1500)}`);
    await visitor.goto(`/meropriyatiya/event/${slug}`);
    await expect(visitor.locator(".event-facts")).toContainText(`Участие${rub(1500)}`);

    // Без услуг: к оплате только участие.
    const onlyEvent = uniqueName("Только участие");
    await fillParticipant(visitor, onlyEvent);
    await expect(visitor.getByTestId("summary-event-price")).toHaveText(rub(1500));
    await expect(visitor.getByTestId("summary-total")).toHaveText(rub(1500));
    await expect(visitor.getByText("Оплатить участие можно будет сразу после регистрации.")).toBeVisible();
    await visitor.locator(".summary-section").screenshot({ path: shot("v11-desktop-paid-summary.png") });
    await visitor.getByRole("button", { name: "Зарегистрироваться" }).click();
    await expect(visitor.getByTestId("receipt-event-price")).toHaveText(rub(1500));
    await expect(visitor.getByTestId("receipt-total")).toHaveText(rub(1500));
    await visitor.getByRole("link", { name: "Оплатить участие" }).click();
    await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("Оплата участия");
    await expect(visitor.getByTestId("payment-amount")).toHaveText(rub(1500));
    await visitor.getByText("Из чего складывается сумма").click();
    await expect(visitor.locator(".payment-items li")).toHaveText([`Участие в мероприятии${rub(1500)}`]);

    // С платной услугой: участие + услуга.
    await visitor.goto(`/meropriyatiya/event/${slug}`);
    const withSauna = uniqueName("С баней");
    await fillParticipant(visitor, withSauna);
    await visitor.getByRole("checkbox", { name: /Баня/ }).check();
    await expect(visitor.getByTestId("summary-total")).toHaveText(rub(5000));
    await visitor.getByRole("button", { name: "Зарегистрироваться" }).click();
    await visitor.getByRole("link", { name: "Оплатить участие и услуги" }).click();
    await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("Оплата участия и услуг");
    await expect(visitor.getByTestId("payment-amount")).toHaveText(rub(5000));
    await visitor.screenshot({ path: shot("v11-desktop-paid-payment.png") });
    await visitor.close();

    // Сумму посчитал сервер; смена цены не трогает уже сделанные регистрации.
    await page.goto(`/meropriyatiya/admin/events/${id}`);
    await page.locator("#main").getByLabel("Стоимость участия, ₽ (необязательно)").fill("2000");
    await page.getByRole("button", { name: "Сохранить изменения" }).click();
    await expect(page.locator("#main").getByLabel("Стоимость участия, ₽ (необязательно)")).toHaveValue("2000");
    const rows = readDb<{ full_name: string; event_price_kopecks: number; fixed_total_kopecks: number }>(
      "SELECT full_name, event_price_kopecks, fixed_total_kopecks FROM registrations WHERE event_id = ? ORDER BY id",
      id,
    );
    expect(rows).toEqual([
      { full_name: onlyEvent, event_price_kopecks: 150000, fixed_total_kopecks: 150000 },
      { full_name: withSauna, event_price_kopecks: 150000, fixed_total_kopecks: 500000 },
    ]);

    // Уборка.
    await page.goto(`/meropriyatiya/admin/events/${id}#cleanup`);
    await page.getByLabel(/Я понимаю/).check();
    await page.getByRole("button", { name: /Удалить регистрации/ }).click();
    await page.getByLabel(/Для подтверждения введите название/).fill(title);
    await page.getByRole("button", { name: "Удалить мероприятие навсегда" }).click();
    await expect(page).toHaveURL(/\/admin\?deleted=/);
  });

  test("блок «Дополнительно» рядом с анкетой редактируется в админке", async ({ page, browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Сценарий проверяется на desktop");
    test.setTimeout(120_000);
    await login(page);
    const title = `Липовая свадьба ${Date.now().toString(36)}`;
    const { id, slug } = await createEvent(page, title);
    const extraField = page.locator("#main").getByLabel(/Блок «Дополнительно»/);
    await extraField.fill("Возьмите с собой тёплую одежду и фонарик.\nЗаезд на территорию — с 16:00, парковка у главного входа.");
    await page.getByRole("button", { name: "Сохранить изменения" }).click();
    await expect(page.locator("#main").getByLabel(/Блок «Дополнительно»/)).toHaveValue(/Заезд на территорию/);
    await page.getByRole("button", { name: "Опубликовать" }).click();
    await expect(page.getByText("Опубликовано").first()).toBeVisible();

    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const device = viewport.width > 700 ? "desktop" : "mobile";
      const visitor = await newEventPage(browser, { viewport });
      await visitor.goto(`/meropriyatiya/event/${slug}`);
      const extra = visitor.getByTestId("extra-info");
      await expect(extra.getByRole("heading", { name: "Дополнительно" })).toBeVisible();
      // Перенос строки из админки сохраняется.
      expect(await extra.locator("p").innerText()).toBe(
        "Возьмите с собой тёплую одежду и фонарик.\nЗаезд на территорию — с 16:00, парковка у главного входа.",
      );
      // Блок — в левой колонке шага «Данные участника», поля ФИО по-прежнему рядом/ниже.
      await expect(visitor.locator(".guest-step .guest-intro [data-testid='extra-info']")).toHaveCount(1);
      await expectNoHorizontalOverflow(visitor);
      await visitor.locator("#registration").screenshot({ path: shot(`v12-${device}-extra-info.png`) });
      await visitor.close();
    }

    // Пустой текст — блока нет.
    await page.goto(`/meropriyatiya/admin/events/${id}`);
    await page.locator("#main").getByLabel(/Блок «Дополнительно»/).fill("");
    await page.getByRole("button", { name: "Сохранить изменения" }).click();
    await expect(page.locator("#main").getByLabel(/Блок «Дополнительно»/)).toHaveValue("");
    const visitor = await newEventPage(browser);
    await visitor.goto(`/meropriyatiya/event/${slug}`);
    await expect(visitor.getByRole("heading", { name: "Данные участника" })).toBeVisible();
    await expect(visitor.getByTestId("extra-info")).toHaveCount(0);
    await visitor.close();

    await page.goto(`/meropriyatiya/admin/events/${id}#cleanup`);
    await page.getByLabel(/Для подтверждения введите название/).fill(title);
    await page.getByRole("button", { name: "Удалить мероприятие навсегда" }).click();
    await expect(page).toHaveURL(/\/admin\?deleted=/);
  });

  test("свиток «Подробнее»: подробное описание из админки разворачивается под объём текста", async ({ page, browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Сценарий проверяется на desktop");
    test.setTimeout(150_000);
    await login(page);
    const title = `Новогодняя ночь ${Date.now().toString(36)}`;
    const { id, slug } = await createEvent(page, title);
    const field = () => page.locator("#main").getByLabel(/Подробное описание/);
    const save = async (text: string) => {
      await field().fill(text);
      await page.getByRole("button", { name: "Сохранить изменения" }).click();
      await expect(field()).toHaveValue(text);
    };
    const short = "30 декабря — заезд и знакомство с ведущими.\n\n31 декабря — главный вечер с дуэтом «Флэш».";
    await save(short);
    await page.getByRole("button", { name: "Опубликовать" }).click();
    await expect(page.getByText("Опубликовано").first()).toBeVisible();

    // Высота развёрнутого полотна для текста; свиток закрывается кнопкой «Свернуть свиток», крестиком и Escape.
    const sheetHeight = async (viewport: { width: number; height: number }, device: string, shots: boolean) => {
      const visitor = await newEventPage(browser, { viewport });
      await visitor.goto(`/meropriyatiya/event/${slug}`);
      const rolled = visitor.getByRole("button", { name: "Подробнее о мероприятии" });
      await expect(rolled).toBeVisible();
      await expect(rolled.locator(".scroll-closed-label")).toHaveCSS("font-family", /Balkara/);
      await expectNoHorizontalOverflow(visitor);
      if (shots) await visitor.locator(".hero").screenshot({ path: shot(`v14-${device}-scroll-closed.png`) });
      await rolled.click();
      const dialog = visitor.getByRole("dialog", { name: `«${title}»` });
      await expect(dialog).toBeVisible();
      await visitor.waitForTimeout(900); // анимация разворачивания
      const height = (await dialog.locator(".scroll-sheet").boundingBox())!.height;
      // Текст — шрифтом заголовка; заглавные набраны крупнее строчных; полосы прокрутки нет, свиток открыт с начала.
      await expect(dialog.locator(".scroll-text")).toHaveCSS("font-family", /Balkara/);
      expect(await dialog.locator(".scroll-text .scroll-cap").count()).toBeGreaterThan(0);
      expect(await dialog.evaluate((el) => [(el as HTMLElement).offsetWidth - el.clientWidth, el.scrollTop])).toEqual([0, 0]);
      await expect(dialog.locator(".scroll-close")).toBeFocused();
      if (shots) await visitor.screenshot({ path: shot(`v14-${device}-scroll-open.png`) });
      // До кнопки «Свернуть свиток» в конце текста можно долистать.
      const fold = dialog.locator(".scroll-fold");
      await fold.scrollIntoViewIfNeeded();
      await expect(fold).toBeInViewport();
      await fold.click();
      await expect(dialog).toBeHidden();
      await expect(rolled).toBeFocused();
      await rolled.click();
      await expect(dialog).toBeVisible();
      await dialog.locator(".scroll-close").click();
      await expect(dialog).toBeHidden();
      await rolled.click();
      await expect(dialog).toBeVisible();
      await visitor.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await visitor.close();
      return height;
    };

    const shortDesktop = await sheetHeight({ width: 1440, height: 900 }, "desktop", true);
    await sheetHeight({ width: 390, height: 844 }, "mobile", true);

    // Длинный текст (длина не ограничена): полотно вытягивается, текст и переносы на месте.
    await page.goto(`/meropriyatiya/admin/events/${id}`);
    const long = Array.from({ length: 40 }, (_, i) => `${i + 1}. Пункт программы: песни, конкурсы и танцы до утра.`).join("\n");
    await save(long);
    const longDesktop = await sheetHeight({ width: 1440, height: 900 }, "desktop", false);
    expect(longDesktop).toBeGreaterThan(shortDesktop + 600);
    const visitor = await newEventPage(browser);
    await visitor.goto(`/meropriyatiya/event/${slug}`);
    await visitor.getByRole("button", { name: "Подробнее о мероприятии" }).click();
    expect(await visitor.locator(".scroll-text").innerText()).toBe(long);
    await visitor.close();

    // Пустое описание — свитка нет.
    await save("");
    const empty = await newEventPage(browser);
    await empty.goto(`/meropriyatiya/event/${slug}`);
    await expect(empty.getByRole("heading", { name: "Данные участника" })).toBeVisible();
    await expect(empty.getByRole("button", { name: "Подробнее о мероприятии" })).toHaveCount(0);
    await empty.close();

    await page.goto(`/meropriyatiya/admin/events/${id}#cleanup`);
    await page.getByLabel(/Для подтверждения введите название/).fill(title);
    await page.getByRole("button", { name: "Удалить мероприятие навсегда" }).click();
    await expect(page).toHaveURL(/\/admin\?deleted=/);
  });

  test("уведомления: статус Telegram и тестовая отправка только для администратора", async ({ page, browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Сценарий проверяется на desktop");
    await login(page);
    await page.goto("/meropriyatiya/admin/settings");
    await expect(page.getByTestId("telegram-status")).toHaveText("Telegram настроен");
    // Токен и chat_id на страницу не попадают.
    const html = await page.content();
    expect(html).not.toContain(E2E_TELEGRAM.token);
    expect(html).not.toContain(E2E_TELEGRAM.chatId);

    const isTestMessage = (text: string) => text.startsWith("✅ Тестовое уведомление");
    const before = telegramRequests().filter((request) => isTestMessage(request.text)).length;
    const [actionRequest] = await Promise.all([
      page.waitForRequest((request) => request.method() === "POST" && !!request.headers()["next-action"]),
      page.getByRole("button", { name: "Отправить тестовое уведомление" }).click(),
    ]);
    await expect(page.getByText("Тестовое уведомление отправлено. Проверьте чат в Telegram.")).toBeVisible();
    const sent = telegramRequests().filter((request) => isTestMessage(request.text));
    expect(sent).toHaveLength(before + 1);
    expect(sent.at(-1)).toMatchObject({
      tokenOk: true,
      chatId: E2E_TELEGRAM.chatId,
      text: ["✅ Тестовое уведомление", "", "Связь с системой регистрации «Рублёвки» работает."].join(String.fromCharCode(10)),
    });
    await page.screenshot({ path: shot("v4-admin-settings-telegram.png") });

    // Повтор того же server action без сессии: перенаправление на вход, сообщение не отправляется.
    const anonymous = await browser.newContext();
    const headers = actionRequest.headers();
    const replay = await anonymous.request.post(actionRequest.url(), {
      headers: {
        "next-action": headers["next-action"],
        "content-type": headers["content-type"],
        accept: headers["accept"] ?? "text/x-component",
        origin: headers["origin"] ?? new URL(actionRequest.url()).origin,
      },
      data: actionRequest.postDataBuffer() ?? "",
      maxRedirects: 0,
    });
    expect(`${replay.headers()["x-action-redirect"] ?? ""} ${replay.headers()["location"] ?? ""}`).toMatch(/(?:\/meropriyatiya)?\/admin\/login(?:;|\s|$)/);
    expect(telegramRequests().filter((request) => isTestMessage(request.text))).toHaveLength(before + 1);
    await anonymous.close();
  });

  test("неотправленное уведомление остаётся в outbox и повторяется из админки", async ({ page, browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Сценарий проверяется на desktop");
    // Mock Telegram не принимает сообщение с маркером FLAKY- с первой попытки (502). В уведомлении нет имени
    // участника — только название мероприятия, поэтому маркер — в названии отдельного тестового мероприятия.
    const marker = `FLAKY-${Date.now().toString(36)}`;
    const title = `Повтор уведомления ${marker}`;
    await login(page);
    const { id, slug } = await createEvent(page, title);
    await page.getByRole("button", { name: "Опубликовать" }).click();
    await expect(page.getByText("Опубликовано").first()).toBeVisible();
    const name = `Тестов Повтор ${marker}`;
    const publicPage = await page.context().newPage();
    await publicPage.goto(`/meropriyatiya/event/${slug}`);
    await fillParticipant(publicPage, name, null);
    await publicPage.getByRole("button", { name: "Зарегистрироваться" }).click();
    // Регистрация успешна независимо от Telegram.
    await expect(publicPage.getByRole("heading", { name: "Регистрация завершена" })).toBeVisible();

    const outboxRow = () =>
      readDb<{ status: string; attempts: number; last_error: string | null }>(
        "SELECT o.status, o.attempts, o.last_error FROM telegram_notification_outbox o JOIN registrations r ON r.id = o.registration_id WHERE r.full_name = ?",
        name,
      )[0];
    await expect.poll(() => outboxRow()?.attempts).toBe(1);
    expect(outboxRow()).toMatchObject({ status: "pending" });
    expect(outboxRow().last_error).toContain("502");
    expect(outboxRow().last_error).not.toContain(E2E_TELEGRAM.token);

    await page.goto("/meropriyatiya/admin/settings");
    await expect(page.getByTestId("outbox-pending")).not.toHaveText("0");
    await page.locator("#settings-telegram").locator("..").screenshot({ path: shot("v5-admin-settings-outbox.png") });

    // Повтор без сессии администратора не выполняется.
    const [actionRequest] = await Promise.all([
      page.waitForRequest((request) => request.method() === "POST" && !!request.headers()["next-action"]),
      page.getByRole("button", { name: "Повторить неотправленные" }).click(),
    ]);
    await expect(page.getByText(/Отправлено/)).toBeVisible();
    await expect.poll(() => outboxRow()?.status).toBe("sent");
    expect(outboxRow().attempts).toBe(2);
    expect(telegramRequests().filter((request) => request.text.includes(marker))).toHaveLength(2);

    const anonymous = await browser.newContext();
    const headers = actionRequest.headers();
    const replay = await anonymous.request.post(actionRequest.url(), {
      headers: {
        "next-action": headers["next-action"],
        "content-type": headers["content-type"],
        accept: headers["accept"] ?? "text/x-component",
        origin: headers["origin"] ?? new URL(actionRequest.url()).origin,
      },
      data: actionRequest.postDataBuffer() ?? "",
      maxRedirects: 0,
    });
    expect(`${replay.headers()["x-action-redirect"] ?? ""} ${replay.headers()["location"] ?? ""}`).toMatch(/(?:\/meropriyatiya)?\/admin\/login(?:;|\s|$)/);
    await anonymous.close();
    // Уже отправленное уведомление повторно не уходит.
    expect(telegramRequests().filter((request) => request.text.includes(marker))).toHaveLength(2);
    // В уведомлениях — ни имени, ни телефона участника.
    for (const request of telegramRequests().filter((item) => item.text.includes(marker))) {
      expect(request.text).not.toContain("Тестов");
      expect(request.text).not.toContain("+7 900");
    }

    await page.goto(`/meropriyatiya/admin/events/${id}#cleanup`);
    await page.getByLabel(/Для подтверждения введите название/).fill(title);
    await page.getByRole("button", { name: "Удалить мероприятие навсегда" }).click();
    await expect(page).toHaveURL(/\/admin\?deleted=/);
  });
});

test("mobile: админпанель без горизонтального переполнения", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile-сценарий");
  await login(page);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: shot("v3-admin-mobile-01-events.png"), fullPage: true });

  const [{ id }] = readDb<{ id: number }>("SELECT id FROM events WHERE slug = 'vstrecha-na-rublevke'");
  await page.goto(`/meropriyatiya/admin/events/${id}`);
  await waitForImages(page);
  await expectNoHorizontalOverflow(page);
  await page.locator("#activities").screenshot({ path: shot("v3-admin-mobile-02-activities.png") });
  await page.locator("#registrations").screenshot({ path: shot("v3-admin-mobile-03-registrations.png") });

  for (const url of ["/meropriyatiya/admin/settings", "/meropriyatiya/admin/events/new", `/meropriyatiya/admin/events/${id}/activities/new`]) {
    await page.goto(url);
    await expectNoHorizontalOverflow(page);
  }
});
