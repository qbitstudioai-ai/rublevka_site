import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";
import { updateActivity } from "@/lib/server/repo/activities";
import { createRegistration, listRegistrations } from "@/lib/server/repo/registrations";
import { participantsFileName, participantsXlsx, SHEET_NAME, toExcelLocalDate } from "@/lib/server/excel";
import { registrationSchema } from "@/lib/server/validation";
import { activityInput, freshDb, makeActivity, makeEvent } from "./helpers";

const EVENT_TITLE = "Встреча на Рублёвке";
const BASE_HEADERS = ["Дата регистрации", "Название мероприятия", "ФИО", "Телефон", "Мессенджер"];

/** Генерирует .xlsx и читает его обратно, как это сделал бы Excel. */
async function readBack(registrations: ReturnType<typeof listRegistrations>) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await participantsXlsx(registrations, EVENT_TITLE)) as unknown as ArrayBuffer);
  const sheet = workbook.getWorksheet(SHEET_NAME)!;
  const headers = (sheet.getRow(1).values as unknown[]).slice(1);
  return { workbook, sheet, headers };
}

function setup() {
  const { db } = freshDb();
  const { id: eventId } = makeEvent(db);
  const a = makeActivity(db, eventId, { title: "Литературная гостиная", price: "3500" });
  const b = makeActivity(db, eventId, { title: "Проживание", pricingType: "contact" });
  const c = makeActivity(db, eventId, { title: "Баня", price: "6500,50" });
  const register = (fullName: string, activityIds: number[], messenger?: string, event = eventId) =>
    createRegistration(db, event, registrationSchema.parse({ fullName, phone: "+7 900 000-00-00", messenger, activityIds }));
  return { db, eventId, a, b, c, register };
}

test("0 регистраций: файл только с заголовками, без колонок услуг", async () => {
  const { db, eventId } = setup();
  const { workbook, sheet, headers } = await readBack(listRegistrations(db, eventId));
  expect(workbook.worksheets.map((ws) => ws.name)).toEqual(["Участники"]);
  expect(headers).toEqual([...BASE_HEADERS, "Фиксированная сумма"]);
  expect(sheet.rowCount).toBe(1);
});

test("1 регистрация: значения, типы ячеек и оформление", async () => {
  const { db, eventId, a, b, register } = setup();
  const registration = register("Иванов Иван Иванович", [a, b], "Telegram: @ivanov");
  const { sheet, headers } = await readBack(listRegistrations(db, eventId));

  expect(headers).toEqual([...BASE_HEADERS, "Услуга 1", "Услуга 2", "Фиксированная сумма"]);
  const row = sheet.getRow(2);
  expect(row.getCell(2).value).toBe(EVENT_TITLE);
  expect(row.getCell(3).value).toBe("Иванов Иван Иванович");
  expect(row.getCell(4).value).toBe("+7 900 000-00-00");
  expect(row.getCell(5).value).toBe("Telegram: @ivanov");
  expect(row.getCell(6).value).toBe("Литературная гостиная");
  expect(row.getCell(7).value).toBe("Проживание");

  // Сумма — число в рублях с денежным форматом, а не текст «3 500 ₽».
  const total = row.getCell(8);
  expect(total.value).toBe(3500);
  expect(total.type).toBe(ExcelJS.ValueType.Number);
  expect(total.numFmt).toBe('#,##0 "₽"');

  // Дата — настоящая дата Excel со временем комплекса.
  const date = row.getCell(1);
  expect(date.type).toBe(ExcelJS.ValueType.Date);
  expect(date.numFmt).toBe("dd.mm.yyyy hh:mm");
  expect((date.value as Date).toISOString()).toBe(toExcelLocalDate(registration.created_at).toISOString());

  expect(sheet.getRow(1).font?.bold).toBe(true);
  expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
  expect(sheet.autoFilter).toBeTruthy();
  expect(sheet.getColumn(3).width).toBeGreaterThan(20);
});

test("разное число услуг: колонки «Услуга 1…N» по максимуму, пустые ячейки и порядок", async () => {
  const { db, eventId, a, b, c, register } = setup();
  register("Участник A", [a]);
  register("Участник B", [c, a, b]); // выбрано в другом порядке — сохраняется порядок анкеты
  register("Участник C", [b, c]);
  register("Участник D", []);
  const { sheet, headers } = await readBack(listRegistrations(db, eventId));

  expect(headers).toEqual([...BASE_HEADERS, "Услуга 1", "Услуга 2", "Услуга 3", "Фиксированная сумма"]);
  expect(headers.filter((header) => String(header).startsWith("Услуга"))).toHaveLength(3);
  const services = (rowNumber: number) => [6, 7, 8].map((col) => sheet.getRow(rowNumber).getCell(col).value ?? null);
  expect(sheet.getRow(2).getCell(3).value).toBe("Участник A");
  expect(services(2)).toEqual(["Литературная гостиная", null, null]);
  expect(services(3)).toEqual(["Литературная гостиная", "Проживание", "Баня"]);
  expect(services(4)).toEqual(["Проживание", "Баня", null]);
  expect(services(5)).toEqual([null, null, null]);
  // Копейки в сумме → формат с двумя знаками.
  expect(sheet.getRow(3).getCell(9).value).toBe(10000.5);
  expect(sheet.getRow(3).getCell(9).numFmt).toBe('#,##0.00 "₽"');
  expect(sheet.getRow(5).getCell(9).value).toBe(0);
});

test("пустой мессенджер — пустая ячейка; названия из snapshot", async () => {
  const { db, eventId, a, register } = setup();
  register("Без мессенджера", [a], "");
  updateActivity(db, eventId, a, activityInput({ title: "Переименованная услуга", price: "9000" }), undefined, { add: [], removeIds: [] });
  const { sheet } = await readBack(listRegistrations(db, eventId));
  const row = sheet.getRow(2);
  expect(row.getCell(5).value ?? null).toBeNull();
  expect(String(row.getCell(5).text)).not.toMatch(/null|undefined/);
  expect(row.getCell(6).value).toBe("Литературная гостиная");
  expect(row.getCell(7).value).toBe(3500);
});

test("выгрузка мероприятия A не содержит участников B", async () => {
  const { db, eventId, a, register } = setup();
  const { id: otherEventId } = makeEvent(db);
  const otherActivity = makeActivity(db, otherEventId, { title: "Чужая услуга" });
  register("Участник события A", [a]);
  register("Участник события B", [otherActivity], undefined, otherEventId);

  const { sheet } = await readBack(listRegistrations(db, eventId));
  const names = [];
  for (let row = 2; row <= sheet.rowCount; row += 1) names.push(sheet.getRow(row).getCell(3).value);
  expect(names).toEqual(["Участник события A"]);
});

test("безопасное имя файла", () => {
  expect(participantsFileName({ slug: "vstrecha-na-rublevke", event_date: "2026-10-24" })).toBe("vstrecha-na-rublevke_uchastniki_2026-10-24.xlsx");
  expect(participantsFileName({ slug: '../../evil"\r\nX', event_date: "bad" })).toBe("meropriyatie_uchastniki_data.xlsx");
});

test("платное участие: отдельная колонка, итог включает участие", async () => {
  const { db } = freshDb();
  const { id: eventId } = makeEvent(db, { price: "1500" });
  const sauna = makeActivity(db, eventId, { title: "Баня", price: "6500" });
  createRegistration(db, eventId, registrationSchema.parse({ fullName: "Только участие", phone: "+7 900 000-00-01", activityIds: [] }));
  createRegistration(db, eventId, registrationSchema.parse({ fullName: "С баней", phone: "+7 900 000-00-02", activityIds: [sauna] }));
  const { sheet, headers } = await readBack(listRegistrations(db, eventId));

  expect(headers).toEqual([...BASE_HEADERS, "Участие в мероприятии", "Услуга 1", "Фиксированная сумма"]);
  expect([2, 3].map((row) => sheet.getRow(row).getCell(6).value)).toEqual([1500, 1500]);
  expect(sheet.getRow(2).getCell(6).numFmt).toBe('#,##0 "₽"');
  expect([2, 3].map((row) => sheet.getRow(row).getCell(8).value)).toEqual([1500, 8000]);
});
