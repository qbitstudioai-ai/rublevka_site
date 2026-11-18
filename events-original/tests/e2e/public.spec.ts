import { expect, test, type Page } from "@playwright/test";
import { formatEventDate } from "@/lib/format";
import { E2E_DATA_DIR, E2E_TELEGRAM } from "../test-env";
import { expectNoHorizontalOverflow, fillParticipant, readDb, shot, uniqueName, waitForImages, waitForTelegram } from "./helpers";

const DEMO = "/event/vstrecha-na-rublevke";
/** Дата демо-мероприятия в e2e: e2e-prepare сдвигает его на неделю вперёд, чтобы регистрация была открыта. */
const demoDateLabel = () =>
  formatEventDate(readDb<{ event_date: string }>("SELECT event_date FROM events WHERE slug = 'vstrecha-na-rublevke'")[0].event_date);
const activity = (page: Page, title: string) => page.getByRole("checkbox", { name: new RegExp(title) });

test.describe("публичная анкета", () => {
  test("назначение страницы и данные мероприятия из БД", async ({ page }) => {
    await page.goto(DEMO);
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toContainText("Регистрация участников");
    await expect(h1).toContainText("Встреча на Рублёвке");
    await expect(page.getByText(demoDateLabel())).toBeVisible();
    await expect(page.locator(".activity-card")).toHaveCount(4);
    const heading = await page.getByRole("heading", { name: "Данные участника" }).boundingBox();
    expect(heading!.y).toBeLessThan(page.viewportSize()!.height);
  });

  test("главная — список мероприятий, неизвестный slug — 404", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ближайшие мероприятия");
    // Логотип ведёт на основной сайт, справа — вход в админпанель (без сессии — страница входа).
    await expect(page.getByRole("link", { name: /основной сайт/ })).toHaveAttribute("href", "https://rublevka34.com/");
    await expect(page.getByText("rublevka34.com", { exact: true })).toHaveCount(0);
    await page.getByRole("link", { name: "Админпанель" }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);
    await page.goto("/");
    // Состав списка зависит от даты запуска и параллельных тестов: либо карточки, либо пустое состояние.
    const cards = page.getByTestId("event-card");
    if ((await cards.count()) === 0) {
      await expect(page.getByRole("heading", { name: "Сейчас нет открытых регистраций" })).toBeVisible();
    } else {
      for (const link of await page.getByRole("link", { name: /^Зарегистрироваться: / }).all()) {
        await expect(link).toHaveAttribute("href", /^\/event\/[a-z0-9-]+$/);
      }
    }

    const response = await page.goto("/event/net-takogo-meropriyatiya");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Страница недоступна" })).toBeVisible();
    await page.getByRole("link", { name: "Все мероприятия" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("кнопка «Назад к списку мероприятий» на первом экране анкеты", async ({ page }) => {
    // Прямой переход: демо-мероприятие пропадает из списка после своей даты.
    await page.goto(DEMO);
    const back = page.getByRole("link", { name: "Назад к списку мероприятий" });
    await expect(back).toBeVisible();
    // Видна без прокрутки и не мельче минимальной зоны нажатия.
    const box = (await back.boundingBox())!;
    expect(box.y + box.height).toBeLessThan(page.viewportSize()!.height);
    expect(box.height).toBeGreaterThanOrEqual(48);
    await back.click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ближайшие мероприятия");
  });

  test("три отдельных полноширинных поля", async ({ page }) => {
    await page.goto(DEMO);
    const fields = [page.getByLabel("ФИО"), page.getByLabel("Телефон"), page.getByLabel("Мессенджер для связи")];
    const boxes = [];
    for (const field of fields) {
      await expect(field).toBeVisible();
      boxes.push((await field.boundingBox())!);
    }
    await expect(page.locator("select")).toHaveCount(0);
    expect(boxes[1].y).toBeGreaterThan(boxes[0].y + boxes[0].height);
    expect(boxes[2].y).toBeGreaterThan(boxes[1].y + boxes[1].height);
    for (const box of boxes) expect(Math.abs(box.width - boxes[0].width)).toBeLessThan(1);
  });

  test("обязательны ФИО и телефон, мессенджер — по желанию", async ({ page }) => {
    await page.goto(DEMO);
    await expect(page.getByText("ФИО и телефон обязательны")).toBeVisible();
    await expect(page.getByLabel("Мессенджер для связи (необязательно)")).not.toHaveAttribute("required", "");
    await page.getByRole("button", { name: "Зарегистрироваться" }).click();
    await expect(page.getByText("Укажите фамилию, имя и отчество.")).toBeVisible();
    await expect(page.getByText("Укажите телефон полностью")).toBeVisible();
    await expect(page.getByText(/Укажите мессенджер/)).toHaveCount(0);
    await expect(page.getByLabel("ФИО")).toBeFocused();

    // Только ФИО — телефон по-прежнему обязателен.
    await page.getByLabel("ФИО").fill(uniqueName("Без телефона"));
    await page.getByRole("button", { name: "Зарегистрироваться" }).click();
    await expect(page.getByLabel("Телефон")).toBeFocused();
    await expect(page.getByRole("heading", { name: "Регистрация завершена" })).toHaveCount(0);
  });

  test("регистрация без мессенджера и уведомление администрации", async ({ page, baseURL }) => {
    await page.goto(DEMO);
    const name = uniqueName("Без мессенджера");
    await fillParticipant(page, name, null);
    await page.getByRole("button", { name: "Зарегистрироваться" }).click();
    await expect(page.getByRole("heading", { name: "Регистрация завершена" })).toBeVisible();
    await expect(page.getByTestId("receipt-contacts")).toHaveText("+7 900 000-00-00");

    const [{ messenger, public_id: publicId, event_id: eventId }] = readDb<{ messenger: string | null; public_id: string; event_id: number }>(
      "SELECT messenger, public_id, event_id FROM registrations WHERE full_name = ?",
      name,
    );
    expect(messenger).toBeNull();

    // В Telegram (зарубежный сервис) — только мероприятие и ссылка на регистрацию в админке, без ФИО и телефона.
    const notice = await waitForTelegram(publicId);
    expect(notice.tokenOk).toBe(true);
    expect(notice.chatId).toBe(E2E_TELEGRAM.chatId);
    expect(notice.text).toBe(`Новая регистрация на мероприятие «Встреча на Рублёвке»\n${baseURL}/admin/events/${eventId}/registrations/${publicId}`);
    expect(notice.text).not.toContain(name);
    expect(notice.text).not.toContain("+7 900");

    // Durable outbox: запись уведомления отмечена как отправленная.
    await expect
      .poll(() =>
        readDb<{ status: string; attempts: number }>(
          "SELECT o.status, o.attempts FROM telegram_notification_outbox o JOIN registrations r ON r.id = o.registration_id WHERE r.full_name = ?",
          name,
        ),
      )
      .toEqual([{ status: "sent", attempts: 1 }]);
  });

  test("/api/health: ok без путей и секретов", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    const body = await response.json();
    expect(body).toMatchObject({ status: "ok", checks: { database: "ok", migrations: "ok", uploads: "ok" } });
    const text = JSON.stringify(body);
    expect(text).not.toContain(E2E_DATA_DIR);
    expect(text).not.toContain(E2E_TELEGRAM.token);
    expect(text).not.toMatch(/sqlite|uploads[\\/]|[A-Z]:\\/i);
  });

  test("регистрация без услуг: подтверждение без оплаты", async ({ page }) => {
    await page.goto(DEMO);
    const name = uniqueName("Без услуг");
    await fillParticipant(page, name);
    await expect(page.getByTestId("summary-total")).toHaveText("0 ₽");
    await page.getByRole("button", { name: "Зарегистрироваться" }).click();

    const success = page.locator("#success-state");
    await expect(success.getByRole("heading", { name: "Регистрация завершена" })).toBeVisible();
    await expect(success).toContainText("Вы зарегистрированы на: «Встреча на Рублёвке»");
    await expect(success).toContainText(name);
    await expect(success).toContainText("Без дополнительных активностей");
    await expect(page.getByTestId("receipt-total")).toHaveText("0 ₽");
    await expect(page.getByRole("link", { name: "Оплатить выбранные услуги" })).toHaveCount(0);
    // После регистрации данные заблокированы от случайного изменения.
    await expect(page.getByLabel("ФИО")).toBeDisabled();

    // Регистрация на 0 ₽ не получает обычный платёжный экран.
    const [{ public_id: publicId, fixed_total_kopecks: total }] = readDb<{ public_id: string; fixed_total_kopecks: number }>(
      "SELECT public_id, fixed_total_kopecks FROM registrations WHERE full_name = ?",
      name,
    );
    expect(total).toBe(0);
    await page.goto(`/payment/${publicId}`);
    await expect(page.getByRole("heading", { name: "Оплата не требуется" })).toBeVisible();
    await expect(page.getByTestId("payment-amount")).toHaveCount(0);
    await expect(page.getByRole("img", { name: /QR-код для оплаты/ })).toHaveCount(0);
  });

  test("бесплатная услуга не открывает оплату", async ({ page }) => {
    await page.goto(DEMO);
    await fillParticipant(page, uniqueName("Костёр"));
    await activity(page, "Песни у костра").check();
    await page.getByRole("button", { name: "Зарегистрироваться" }).click();
    await expect(page.locator("#success-state")).toContainText("Песни у костра — Бесплатно");
    await expect(page.getByTestId("receipt-total")).toHaveText("0 ₽");
    await expect(page.getByRole("link", { name: "Оплатить выбранные услуги" })).toHaveCount(0);
  });

  test("оплата доступна только после регистрации и берёт данные из неё", async ({ page }) => {
    await page.goto(DEMO);
    const name = uniqueName("Оплата");
    await fillParticipant(page, name);
    await activity(page, "Литературная гостиная").check();
    await activity(page, "Проживание").check();
    await activity(page, "Песни у костра").check();
    await expect(page.getByTestId("summary-total")).toHaveText("3 500 ₽");

    // До регистрации рабочего перехода к оплате нет.
    await expect(page.locator('a[href^="/payment"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Оплатить/ })).toHaveCount(0);

    await page.getByRole("button", { name: "Зарегистрироваться" }).click();
    await expect(page.getByTestId("receipt-total")).toHaveText("3 500 ₽");
    await expect(page.getByTestId("receipt-contacts")).toHaveText("+7 900 000-00-00 · Telegram: @ivanov");

    // Уведомление администрации — без выбранных услуг, сумм и контактов: они видны только в админке.
    const [{ public_id: publicId }] = readDb<{ public_id: string }>("SELECT public_id FROM registrations WHERE full_name = ?", name);
    const notice = await waitForTelegram(publicId);
    expect(notice.text.startsWith("Новая регистрация на мероприятие «Встреча на Рублёвке»\n")).toBe(true);
    for (const secret of [name, "@ivanov", "Литературная гостиная", "₽"]) expect(notice.text).not.toContain(secret);

    const payLink = page.getByRole("link", { name: "Оплатить выбранные услуги" });
    await expect(payLink).toBeVisible();
    await payLink.click();

    await expect(page).toHaveURL(/\/payment\/[0-9a-f-]{36}$/);
    expect(page.url()).not.toContain("?");
    expect(decodeURIComponent(page.url())).not.toContain(name);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.getByTestId("payment-amount")).toHaveText("3 500 ₽");
    await expect(page.getByTestId("payment-payer")).toHaveText(name);
    await page.getByText("Из чего складывается сумма").click();
    await expect(page.locator(".payment-items")).toContainText("Литературная гостиная");
    await expect(page.locator(".payment-items")).not.toContainText("Проживание");

    const qr = page.getByRole("img", { name: /QR-код для оплаты/ });
    await expect(qr).toBeVisible();
    expect(await qr.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    const box = (await qr.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    await expectNoHorizontalOverflow(page);

    // Повторное открытие по той же ссылке показывает ту же регистрацию.
    await page.reload();
    await expect(page.getByTestId("payment-amount")).toHaveText("3 500 ₽");
  });

  test("несуществующая регистрация — 404", async ({ page }) => {
    for (const id of ["00000000-0000-4000-8000-000000000000", "not-a-uuid", "1"]) {
      const response = await page.goto(`/payment/${id}`);
      expect(response?.status()).toBe(404);
    }
    expect((await page.goto("/payment"))?.status()).toBe(404);
  });

  test("внизу — блок сообществ: кнопки Telegram, VK, MAX и QR Telegram", async ({ page }) => {
    for (const url of ["/", DEMO]) {
      await page.goto(url);
      const community = page.getByRole("region", { name: "Выбирайте удобное для Вас сообщество" });
      await expect(community).toBeVisible();
      await expect(community).toContainText("общаемся лично");
      // Ссылки — кнопки со значками, адреса на странице не выводятся.
      await expect(community).not.toContainText("https://");
      // Значки платформ декоративные; единственное изображение — QR Telegram-сообщества.
      const qr = community.getByRole("img");
      await expect(qr).toHaveCount(1);
      await expect(qr).toHaveAccessibleName(/QR-код Telegram-сообщества/);
      expect(await qr.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
      const links = community.getByRole("link");
      await expect(links).toHaveText([/Telegram/, /VK/, /MAX/]);
      await expect(community.getByRole("link", { name: "Сообщество «Рублёвки» в Telegram" })).toHaveAttribute("href", "https://t.me/+-G2HEy3Y79M2YmYy");
      await expect(community.getByRole("link", { name: "Сообщество «Рублёвки» в VK" })).toHaveAttribute("href", "https://vk.ru/rublevka34ru");
      await expect(community.getByRole("link", { name: "Сообщество «Рублёвки» в MAX" })).toHaveAttribute("href", /^https:\/\/web\.max\.ru\/join\//);
      for (const link of await links.all()) {
        await expect(link).toHaveAttribute("target", "_blank");
        const box = (await link.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(48);
      }
    }
  });

  test("нет горизонтального переполнения", async ({ page }) => {
    for (const url of ["/", DEMO, "/event/net-takogo"]) {
      await page.goto(url);
      await expectNoHorizontalOverflow(page);
    }
    // Самый узкий телефон и планшет: список и блок сообществ без переполнения.
    for (const width of [320, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await expectNoHorizontalOverflow(page);
    }
    await page.locator(".community-section").screenshot({ path: shot(`v8-tablet-community.png`) });
  });
});

test.describe("скриншоты для UI-ревью", () => {
  test("публичная часть", async ({ page }, testInfo) => {
    const device = testInfo.project.name;
    await page.goto(DEMO);
    await waitForImages(page);
    await page.screenshot({ path: shot(`v3-${device}-public-01-first-screen.png`) });
    await page.locator(".community-section").screenshot({ path: shot(`v8-${device}-community.png`) });

    await fillParticipant(page, "Иванов Иван Иванович");
    await activity(page, "Литературная гостиная").check();
    await activity(page, "Песни у костра").check();
    await page.getByRole("button", { name: "Зарегистрироваться" }).click();
    await expect(page.locator("#success-state")).toBeVisible();
    await page.locator(".summary-section").screenshot({ path: shot(`v3-${device}-public-02-success.png`) });

    await page.getByRole("link", { name: "Оплатить выбранные услуги" }).click();
    await expect(page.getByTestId("payment-amount")).toBeVisible();
    await waitForImages(page);
    await page.screenshot({ path: shot(`v3-${device}-public-03-payment.png`) });
  });
});
