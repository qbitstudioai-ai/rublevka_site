import { expect, test, type Page } from "@playwright/test";
import { collapseAssistant, expectNoHorizontalOverflow, fillParticipant, imageFixture, login, shot, uniqueName, uploadFileExists, waitForImages } from "../e2e/helpers";

test.beforeEach(async ({ context }) => collapseAssistant(context));

/**
 * Тесты, меняющие общие настройки (QR, ссылки, способ оплаты), выполняются отдельным проектом
 * после всех остальных e2e: иначе они мешали бы параллельным проверкам страницы оплаты.
 * Каждый тест возвращает настройки к исходному состоянию (способ «QR-код»).
 */
test.describe.configure({ mode: "serial" });

/** Регистрация с платной услугой и переход на страницу оплаты. */
async function openPaymentPage(page: Page) {
  const publicPage = await page.context().newPage();
  await publicPage.goto("/meropriyatiya/event/vstrecha-na-rublevke");
  await fillParticipant(publicPage, uniqueName("Оплата"));
  await publicPage.getByRole("checkbox", { name: /Литературная гостиная/ }).check();
  await publicPage.getByRole("button", { name: "Зарегистрироваться" }).click();
  await publicPage.getByRole("link", { name: "Оплатить выбранные услуги" }).click();
  await expect(publicPage.getByTestId("payment-amount")).toHaveText("3 500 ₽");
  return publicPage;
}

const METHOD_VALUES = { "QR-код": "qr", "Номер телефона": "phone", "QR-код и номер телефона": "both" } as const;

async function choosePaymentMethod(page: Page, label: keyof typeof METHOD_VALUES) {
  await page.locator(`input[name="paymentMethod"][value="${METHOD_VALUES[label]}"]`).check();
}

test("общие настройки: QR и ссылки оплаты и сообщества", async ({ page }) => {
  await login(page);
  await page.goto("/meropriyatiya/admin/settings");
  await page.getByLabel("QR-код оплаты").setInputFiles(await imageFixture("qr-pay.png", "#000000", 600, 600));
  await page.getByLabel(/Ссылка для кнопки «Открыть Сбербанк»/).fill("https://example.com/pay");
  await page.getByLabel(/Ссылка на Telegram/).fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Сохранить настройки" }).click();
  await expect(page.getByText("Укажите полную ссылку, начинающуюся с https://")).toBeVisible();

  await page.getByLabel(/Ссылка на Telegram/).fill("https://t.me/example");
  await page.getByRole("button", { name: "Сохранить настройки" }).click();
  await expect(page.getByText("Настройки сохранены.")).toBeVisible();
  await waitForImages(page);
  await page.screenshot({ path: shot("v3-admin-09-settings.png"), fullPage: true });

  const firstQr = (await page.locator(".a-image-input.is-square img").first().getAttribute("src"))!;
  expect(firstQr).toMatch(/^\/meropriyatiya\/media\/[0-9a-f-]{36}\.png$/);

  // Ссылки появляются на публичных страницах.
  const eventPage = await page.context().newPage();
  await eventPage.goto("/meropriyatiya/event/vstrecha-na-rublevke");
  await expect(eventPage.getByRole("link", { name: "Сообщество «Рублёвки» в Telegram" })).toHaveAttribute("href", "https://t.me/example");
  const paymentPage = await openPaymentPage(page);
  await expect(paymentPage.getByRole("link", { name: "Открыть Сбербанк" })).toHaveAttribute("href", "https://example.com/pay");
  await expect(paymentPage.getByRole("img", { name: /QR-код для оплаты/ })).toHaveAttribute("src", firstQr);

  // Замена QR удаляет прежний загруженный файл.
  await page.getByLabel("QR-код оплаты").setInputFiles(await imageFixture("qr-pay-2.png", "#222222", 600, 600));
  await page.getByLabel(/Ссылка для кнопки «Открыть Сбербанк»/).fill("");
  await page.getByLabel(/Ссылка на Telegram/).fill("");
  await page.getByRole("button", { name: "Сохранить настройки" }).click();
  // Превью нового файла — blob:-адрес, поэтому ждём именно новый сохранённый /media/ файл.
  await expect
    .poll(async () => {
      const src = await page.locator(".a-image-input.is-square img").first().getAttribute("src");
      return src?.startsWith("/meropriyatiya/media/") && src !== firstQr;
    })
    .toBe(true);
  expect(uploadFileExists(firstQr)).toBe(false);
  await eventPage.goto("/meropriyatiya/event/vstrecha-na-rublevke");
  await expect(eventPage.getByRole("link", { name: /в Telegram/ })).toHaveCount(0);
  await expect(eventPage.getByRole("link", { name: /в VK/ })).toBeVisible();
});

test("сообщества: QR Telegram, ссылки VK и MAX", async ({ page }) => {
  await login(page);
  await page.goto("/meropriyatiya/admin/settings");
  const original = {
    telegram: await page.getByLabel(/Ссылка на Telegram/).inputValue(),
    vk: await page.getByLabel(/Ссылка на VK/).inputValue(),
    max: await page.getByLabel(/Ссылка на MAX/).inputValue(),
  };

  // Загруженный QR сообщества появляется в блоке рядом с кнопками.
  await page.getByLabel("QR-код Telegram-сообщества").setInputFiles(await imageFixture("qr-community.png", "#000000", 600, 600));
  await page.getByRole("button", { name: "Сохранить настройки" }).click();
  await expect(page.getByText("Настройки сохранены.")).toBeVisible();
  const home = await page.context().newPage();
  await home.goto("/meropriyatiya");
  await expect(home.locator(".community-qr img")).toHaveAttribute("src", /^\/meropriyatiya\/media\/[0-9a-f-]{36}\.png$/);

  await page.getByLabel(/Ссылка на VK/).fill("http://vk.ru/plain");
  await page.getByRole("button", { name: "Сохранить настройки" }).click();
  await expect(page.locator("#communityVkUrl-error")).toHaveText("Укажите полную ссылку, начинающуюся с https://");

  // Все ссылки пустые — остаётся только QR, кнопок нет.
  for (const label of [/Ссылка на Telegram/, /Ссылка на VK/, /Ссылка на MAX/]) await page.getByLabel(label).fill("");
  await page.getByRole("button", { name: "Сохранить настройки" }).click();
  await expect(page.getByText("Настройки сохранены.")).toBeVisible();
  await home.reload();
  await expect(home.locator(".community-section").getByRole("link")).toHaveCount(0);
  await expect(home.locator(".community-qr img")).toBeVisible();
  await expectNoHorizontalOverflow(home);

  // Только MAX — одна кнопка.
  await page.getByLabel(/Ссылка на MAX/).fill(original.max);
  await page.getByRole("button", { name: "Сохранить настройки" }).click();
  await expect(page.getByText("Настройки сохранены.")).toBeVisible();
  await home.reload();
  await expect(home.locator(".community-section").getByRole("link")).toHaveText([/MAX/]);

  // Исходные ссылки возвращаются для остальных тестов.
  await page.getByLabel(/Ссылка на Telegram/).fill(original.telegram);
  await page.getByLabel(/Ссылка на VK/).fill(original.vk);
  await page.getByRole("button", { name: "Сохранить настройки" }).click();
  await expect(page.getByText("Настройки сохранены.")).toBeVisible();
  // После сохранения форма перерисовывается — снимок делается после загрузки страницы и изображений.
  await waitForImages(page);
  await page.locator("section", { has: page.locator("#settings-community") }).screenshot({ path: shot("v8-admin-settings-community.png") });
});

test("способ оплаты: QR-код, номер телефона или оба", async ({ page }) => {
  await login(page);
  await page.goto("/meropriyatiya/admin/settings");

  // По умолчанию — QR-код; поля телефона скрыты.
  await expect(page.locator('input[name="paymentMethod"][value="qr"]')).toBeChecked();
  await expect(page.getByLabel("Номер телефона для перевода")).toHaveCount(0);

  // «Номер телефона» без номера не сохраняется.
  await choosePaymentMethod(page, "Номер телефона");
  await expect(page.getByLabel("QR-код оплаты")).toHaveCount(0);
  await page.getByRole("button", { name: "Сохранить настройки" }).click();
  await expect(page.getByText("Укажите номер телефона для перевода.")).toBeVisible();

  await page.getByLabel("Номер телефона для перевода").fill("+7 900 123-45-67");
  await page.getByLabel("Получатель (необязательно)").fill("Иван Иванович И.");
  await page.getByRole("button", { name: "Сохранить настройки" }).click();
  await expect(page.getByText("Настройки сохранены.")).toBeVisible();
  await page.locator('section[aria-labelledby="settings-payment"]').screenshot({ path: shot("v6-admin-payment-method.png") });

  // Только телефон: номер, получатель и копирование; QR не показывается.
  let paymentPage = await openPaymentPage(page);
  await expect(paymentPage.getByTestId("payment-phone")).toHaveText("+7 900 123-45-67");
  await expect(paymentPage.getByText("Получатель: Иван Иванович И.")).toBeVisible();
  await expect(paymentPage.getByRole("button", { name: "Скопировать номер" })).toBeVisible();
  await expect(paymentPage.getByRole("img", { name: /QR-код для оплаты/ })).toHaveCount(0);
  await expect(paymentPage.locator(".payment-steps")).toContainText("перевод по номеру телефона");
  await paymentPage.setViewportSize({ width: 390, height: 844 });
  await expectNoHorizontalOverflow(paymentPage);
  await paymentPage.screenshot({ path: shot("v6-mobile-payment-phone.png") });

  // Оба способа: сначала номер, затем QR.
  await page.goto("/meropriyatiya/admin/settings");
  await choosePaymentMethod(page, "QR-код и номер телефона");
  await expect(page.getByLabel("Номер телефона для перевода")).toHaveValue("+7 900 123-45-67");
  await expect(page.getByLabel("QR-код оплаты")).toHaveCount(1);
  await page.getByRole("button", { name: "Сохранить настройки" }).click();
  await expect(page.getByText("Настройки сохранены.")).toBeVisible();

  paymentPage = await openPaymentPage(page);
  await expect(paymentPage.getByTestId("payment-phone")).toHaveText("+7 900 123-45-67");
  await expect(paymentPage.getByRole("img", { name: /QR-код для оплаты/ })).toBeVisible();
  await expect(paymentPage.locator(".payment-steps")).toContainText("или отсканируйте QR-код");
  await paymentPage.setViewportSize({ width: 390, height: 844 });
  await expectNoHorizontalOverflow(paymentPage);
  await paymentPage.screenshot({ path: shot("v6-mobile-payment-both.png"), fullPage: true });

  // Копирование номера (в браузере с разрешением на буфер обмена).
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await paymentPage.getByRole("button", { name: "Скопировать номер" }).click();
  await expect(paymentPage.getByRole("button", { name: "Номер скопирован" })).toBeVisible();
  expect(await paymentPage.evaluate(() => navigator.clipboard.readText())).toBe("+79001234567");

  // Возврат к QR-коду: номер сохранён, но участнику не показывается.
  await page.goto("/meropriyatiya/admin/settings");
  await choosePaymentMethod(page, "QR-код");
  await page.getByRole("button", { name: "Сохранить настройки" }).click();
  await expect(page.getByText("Настройки сохранены.")).toBeVisible();
  paymentPage = await openPaymentPage(page);
  await expect(paymentPage.getByRole("img", { name: /QR-код для оплаты/ })).toBeVisible();
  await expect(paymentPage.getByTestId("payment-phone")).toHaveCount(0);
  await page.goto("/meropriyatiya/admin/settings");
  await choosePaymentMethod(page, "Номер телефона");
  await expect(page.getByLabel("Номер телефона для перевода")).toHaveValue("+7 900 123-45-67");
});
