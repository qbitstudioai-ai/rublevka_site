import { expect, type Page } from "@playwright/test";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { E2E_ADMIN, E2E_DATABASE_PATH, E2E_TELEGRAM, E2E_UPLOADS_DIR } from "../test-env";

export const shot = (name: string) => path.join(process.cwd(), "docs", "ui-review", name);

export async function waitForImages(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
}

let sequence = 0;
/** Уникальное ФИО: e2e-тесты используют одну базу и не должны пересекаться. */
export const uniqueName = (label: string) => `Тестов ${label} ${Date.now().toString(36)}${(sequence += 1)}`;

/** Заполняет анкету; `messenger: null` — оставить необязательное поле пустым. */
export async function fillParticipant(page: Page, fullName: string, messenger: string | null = "Telegram: @ivanov") {
  await page.getByLabel("ФИО").fill(fullName);
  await page.getByLabel("Телефон").fill("+7 900 000-00-00");
  if (messenger !== null) await page.getByLabel("Мессенджер для связи").fill(messenger);
}

type TelegramRequest = { tokenOk: boolean; chatId: string; text: string };

/** Сообщения, которые приложение отправило в mock Telegram Bot API. */
export function telegramRequests(): TelegramRequest[] {
  if (!fs.existsSync(E2E_TELEGRAM.logFile)) return [];
  return fs
    .readFileSync(E2E_TELEGRAM.logFile, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TelegramRequest);
}

/** Ждёт уведомление, в тексте которого есть `marker` (уведомления уходят после ответа пользователю). */
export async function waitForTelegram(marker: string) {
  let found: TelegramRequest | undefined;
  await expect
    .poll(() => (found = telegramRequests().find((request) => request.text.includes(marker))), { timeout: 15_000 })
    .toBeTruthy();
  return found!;
}

export async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Логин").fill(E2E_ADMIN.username);
  await page.getByLabel("Пароль").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** Тестовые изображения на диске для загрузки через input[type=file]. */
export async function imageFixture(name: string, color: string, width = 1200, height = 800) {
  const dir = path.join(process.cwd(), ".e2e-data", "fixtures");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  const image = sharp({ create: { width, height, channels: 3, background: color } });
  await (name.endsWith(".png") ? image.png() : image.jpeg()).toFile(file);
  return file;
}

export const uploadFileExists = (mediaSrc: string) => fs.existsSync(path.join(E2E_UPLOADS_DIR, mediaSrc.replace(/^.*\/media\//, "")));

/** Прямое чтение тестовой БД — только для проверок, не для подготовки данных. */
export function readDb<T>(sql: string, ...params: unknown[]): T[] {
  const db = new Database(E2E_DATABASE_PATH, { readonly: true });
  try {
    return db.prepare(sql).all(...params) as T[];
  } finally {
    db.close();
  }
}
