import ExcelJS from "exceljs";
import { APP_TIME_ZONE } from "../format";
import { SLUG_PATTERN } from "../slug";
import type { RegistrationWithActivities } from "./repo/registrations";

/**
 * Excel-выгрузка участников мероприятия (.xlsx, один лист «Участники»).
 * Колонки услуг динамические: «Услуга 1…N», где N — наибольшее число услуг у одного участника.
 * В ячейках — названия из snapshots регистрации, а не текущие названия услуг.
 */

export const SHEET_NAME = "Участники";
export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Excel хранит дату без часового пояса. Переводим момент регистрации в «настенное» время
 * комплекса, чтобы в файле было 16.10.2026 17:59 так же, как в админпанели.
 */
export function toExcelLocalDate(isoDateTime: string, timeZone = APP_TIME_ZONE): Date {
  const date = new Date(isoDateTime);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second)));
}

/** Безопасное имя файла: только проверенный slug и дата мероприятия. */
export function participantsFileName(event: { slug: string; event_date: string }) {
  const slug = SLUG_PATTERN.test(event.slug) ? event.slug : "meropriyatie";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(event.event_date) ? event.event_date : "data";
  return `${slug}_uchastniki_${date}.xlsx`;
}

/**
 * `eventTitle` — текущее название мероприятия: колонка «Название мероприятия» нужна,
 * чтобы выгрузки разных мероприятий можно было объединять в одну таблицу.
 */
export function buildParticipantsWorkbook(registrations: RegistrationWithActivities[], eventTitle: string): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Регистрация «Рублёвки»";
  const sheet = workbook.addWorksheet(SHEET_NAME, { views: [{ state: "frozen", ySplit: 1 }] });

  // Хронологический порядок: первые зарегистрировавшиеся — сверху.
  const rows = [...registrations].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
  const serviceCount = rows.reduce((max, row) => Math.max(max, row.activities.length), 0);
  const hasKopecks = rows.some((row) => row.fixed_total_kopecks % 100 !== 0 || row.event_price_kopecks % 100 !== 0);
  const moneyFormat = hasKopecks ? '#,##0.00 "₽"' : '#,##0 "₽"';
  // Колонка участия — только если оно было платным хотя бы у одной регистрации.
  const hasEventPrice = rows.some((row) => row.event_price_kopecks > 0);
  const wrap = { wrapText: true, vertical: "top" } as const;

  sheet.columns = [
    { header: "Дата регистрации", key: "createdAt", width: 18, style: { numFmt: "dd.mm.yyyy hh:mm", alignment: { vertical: "top" } } },
    { header: "Название мероприятия", key: "eventTitle", width: 30, style: { alignment: wrap } },
    { header: "ФИО", key: "fullName", width: 32, style: { alignment: wrap } },
    { header: "Телефон", key: "phone", width: 20, style: { alignment: { vertical: "top" } } },
    { header: "Мессенджер", key: "messenger", width: 26, style: { alignment: wrap } },
    ...(hasEventPrice
      ? [{ header: "Участие в мероприятии", key: "eventPrice", width: 20, style: { numFmt: moneyFormat, alignment: { vertical: "top" as const } } }]
      : []),
    ...Array.from({ length: serviceCount }, (_, index) => ({
      header: `Услуга ${index + 1}`,
      key: `service${index + 1}`,
      width: 28,
      style: { alignment: wrap },
    })),
    {
      header: "Фиксированная сумма",
      key: "total",
      width: 20,
      style: { numFmt: moneyFormat, alignment: { vertical: "top" } },
    },
  ];

  for (const registration of rows) {
    const services = Object.fromEntries(registration.activities.map((activity, index) => [`service${index + 1}`, activity.activity_title_snapshot]));
    sheet.addRow({
      createdAt: toExcelLocalDate(registration.created_at),
      eventTitle,
      fullName: registration.full_name,
      phone: registration.phone,
      // Пустой мессенджер — пустая ячейка, без «null».
      messenger: registration.messenger ?? undefined,
      ...(hasEventPrice ? { eventPrice: registration.event_price_kopecks / 100 } : {}),
      ...services,
      total: registration.fixed_total_kopecks / 100,
    });
  }

  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: "middle", wrapText: true };
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
  return workbook;
}

export async function participantsXlsx(registrations: RegistrationWithActivities[], eventTitle: string): Promise<Buffer> {
  const data = await buildParticipantsWorkbook(registrations, eventTitle).xlsx.writeBuffer();
  return Buffer.from(data);
}
