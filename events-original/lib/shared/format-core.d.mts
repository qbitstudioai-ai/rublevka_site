export const APP_TIME_ZONE: string;
export function formatRub(kopecks: number): string;
export function formatEventDate(isoDate: string): string;
export type EventSchedule = {
  /** Пары «подпись — значение» для первого экрана анкеты. */
  facts: { label: string; value: string }[];
  /** Короткая строка для карточки: «17:00 – 23:00» или «17:00 · до 2 ноября». */
  time: string;
  /** Одна строка: «31 октября 2026 · 17:00 – 23:00». */
  line: string;
};
export function formatEventSchedule(event: {
  event_date: string;
  start_time: string;
  end_date?: string | null;
  end_time?: string | null;
}): EventSchedule;
