import { money } from "./presentation";

export function servicePrice(price: number | null, note = "") {
  const suffix = note.trim();
  if (price === null)
    return suffix ? "По согласованию · " + suffix : "По согласованию";
  if (price === 0) return suffix ? "Бесплатно · " + suffix : "Бесплатно";
  return suffix ? money(price) + " " + suffix : money(price);
}
