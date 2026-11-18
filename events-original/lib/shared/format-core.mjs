// Форматирование, общее для приложения (TypeScript) и CLI-скриптов (чистый Node.js).

/** Часовой пояс комплекса (Волгоградская область) для отображения времени регистраций. */
export const APP_TIME_ZONE = "Europe/Volgograd";

/** Копейки → «3 500 ₽» / «3 500,50 ₽». */
export function formatRub(kopecks) {
  const rubles = Math.trunc(kopecks / 100);
  const rest = Math.abs(kopecks % 100);
  const integer = new Intl.NumberFormat("ru-RU").format(rubles);
  return rest ? `${integer},${String(rest).padStart(2, "0")} ₽` : `${integer} ₽`;
}

/** «2026-11-02» → «2 ноября». */
function formatDayMonth(isoDate) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" }).format(date);
}

/**
 * Дата и время мероприятия для подписей.
 * Однодневное: «Дата: 31 октября 2026» + «Время: 17:00 – 23:00» (без окончания — «Начало: 17:00»).
 * Многодневное: «Начало: 31 октября 2026, 17:00» + «Окончание: 2 ноября 2026, 12:00».
 * `time` — короткая строка для карточки списка, `line` — одна строка для уведомлений и админки.
 */
export function formatEventSchedule({ event_date, start_time, end_date = null, end_time = null }) {
  const startDate = formatEventDate(event_date);
  if (!end_date || end_date === event_date) {
    const time = end_time ? `${start_time} – ${end_time}` : start_time;
    return {
      facts: [
        { label: "Дата", value: startDate },
        { label: end_time ? "Время" : "Начало", value: time },
      ],
      time,
      line: `${startDate} · ${time}`,
    };
  }
  const end = end_time ? `${formatEventDate(end_date)}, ${end_time}` : formatEventDate(end_date);
  return {
    facts: [
      { label: "Начало", value: `${startDate}, ${start_time}` },
      { label: "Окончание", value: end },
    ],
    time: `${start_time} · до ${formatDayMonth(end_date)}`,
    line: `${startDate}, ${start_time} — ${end}`,
  };
}

/** «2026-10-24» → «24 октября 2026». */
export function formatEventDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(date)
    .replace(/\s?г\.$/, "");
}
