/** Деньги хранятся и считаются только в целых копейках. */

export type PricingType = "fixed" | "free" | "contact";

import { formatRub } from "./shared/format-core.mjs";

export { formatRub };

/**
 * Разбирает ввод администратора («3500», «3 500», «3500,50») в копейки без float.
 * Возвращает `null`, если строка не является суммой.
 */
export function parseRublesToKopecks(input: string): number | null {
  const normalized = input.replace(/[\s ₽]/g, "").replace(",", ".");
  const match = /^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) return null;
  const fraction = (match[2] ?? "").padEnd(2, "0");
  return Number(match[1]) * 100 + Number(fraction);
}

/** Сумма в рублях для поля ввода админки: 350000 → «3500», 350050 → «3500,50». */
export function kopecksToInput(kopecks: number | null) {
  if (kopecks === null) return "";
  const rest = kopecks % 100;
  return rest ? `${Math.trunc(kopecks / 100)},${String(rest).padStart(2, "0")}` : String(kopecks / 100);
}

/**
 * Что оплачивает участник — для заголовков и кнопок оплаты:
 * «участие», «участие и услуги» или «выбранные услуги».
 */
export function paymentSubject(eventPriceKopecks: number, hasPaidActivities: boolean) {
  if (eventPriceKopecks > 0) return hasPaidActivities ? "участие и услуги" : "участие";
  return "выбранные услуги";
}

/** Заголовок страницы оплаты: «Оплата участия», «Оплата участия и услуг» или «Оплата выбранных услуг». */
export function paymentHeading(eventPriceKopecks: number, hasPaidActivities: boolean) {
  if (eventPriceKopecks > 0) return hasPaidActivities ? "Оплата участия и услуг" : "Оплата участия";
  return "Оплата выбранных услуг";
}

/**
 * Подпись цены:
 * - fixed — сумма и необязательная подпись («6 500 ₽ за компанию»);
 * - free — «Бесплатно» и необязательная подпись;
 * - contact — подпись вместо цены или «Стоимость уточнит администратор».
 */
export function priceText(pricingType: PricingType, kopecks: number | null, suffix: string | null) {
  const extra = suffix?.trim();
  if (pricingType === "fixed" && kopecks !== null) return extra ? `${formatRub(kopecks)} ${extra}` : formatRub(kopecks);
  if (pricingType === "free") return extra ? `Бесплатно · ${extra}` : "Бесплатно";
  return extra || "Стоимость уточнит администратор";
}
