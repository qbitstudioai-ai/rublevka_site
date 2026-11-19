import { z } from "zod";
import { parseRublesToKopecks } from "../money";
import { SLUG_PATTERN } from "../slug";

/** Все данные из браузера и админпанели считаются недоверенными и проходят эти схемы. */

export type FieldErrors = Record<string, string>;

/** Первая ошибка по каждому полю — для вывода рядом с полем. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const isRealDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value === "" ? null : value));

const httpsUrl = z
  .string()
  .trim()
  .max(500, "Ссылка слишком длинная.")
  .transform((value) => (value === "" ? null : value))
  .refine((value) => {
    if (value === null) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !!url.hostname;
    } catch {
      return false;
    }
  }, "Укажите полную ссылку, начинающуюся с https://");

// ---------- Регистрация участника ----------

export const registrationSchema = z.object({
  fullName: z
    .string({ error: "Укажите фамилию, имя и отчество." })
    .trim()
    .min(2, "Укажите фамилию, имя и отчество.")
    .max(150, "ФИО слишком длинное.")
    .regex(/\p{L}/u, "Укажите фамилию, имя и отчество."),
  phone: z
    .string({ error: "Укажите телефон, например +7 900 000-00-00." })
    .trim()
    .max(32, "Телефон слишком длинный.")
    .regex(/^[0-9+()\-\s]*$/, "В телефоне допустимы цифры, пробелы, «+», «-» и скобки.")
    .refine((value) => {
      const digits = value.replace(/\D/g, "").length;
      return digits >= 10 && digits <= 15;
    }, "Укажите телефон полностью, например +7 900 000-00-00."),
  // Мессенджер необязателен: пустое значение сохраняется как NULL.
  messenger: z
    .string()
    .trim()
    .max(120, "Контакт слишком длинный.")
    .optional()
    .transform((value) => (value ? value : null)),
  activityIds: z
    .array(z.number().int().positive())
    .max(50)
    .transform((ids) => [...new Set(ids)]),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;

// ---------- Мероприятие ----------

export const EVENT_STATUSES = ["draft", "published", "archived"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const eventStatusSchema = z.enum(EVENT_STATUSES, { message: "Неизвестный статус." });

export const HERO_FITS = ["cover", "contain"] as const;
export type HeroFit = (typeof HERO_FITS)[number];

export const eventSchema = z
  .object({
    title: z.string().trim().min(1, "Укажите название.").max(160, "Название слишком длинное."),
    slug: z
      .string()
      .trim()
      .min(2, "Slug слишком короткий.")
      .max(80, "Slug слишком длинный.")
      .regex(SLUG_PATTERN, "Только латинские буквы, цифры и дефисы, например vstrecha-na-rublevke."),
    eventDate: z.string().refine(isRealDate, "Укажите дату."),
    startTime: z.string().regex(TIME_PATTERN, "Укажите время в формате ЧЧ:ММ."),
    // Окончание необязательно: пустое поле — NULL.
    endDate: z
      .string()
      .trim()
      .default("")
      .refine((value) => value === "" || isRealDate(value), "Укажите дату окончания.")
      .transform((value) => (value === "" ? null : value)),
    endTime: z
      .string()
      .trim()
      .default("")
      .refine((value) => value === "" || TIME_PATTERN.test(value), "Укажите время в формате ЧЧ:ММ.")
      .transform((value) => (value === "" ? null : value)),
    shortDescription: z.string().trim().max(400, "Описание слишком длинное — до 400 символов."),
    locationText: optionalText(120, "Подпись слишком длинная — до 120 символов."),
    heroFit: z.enum(HERO_FITS, { message: "Выберите, как показывать фото." }).default("cover"),
    // Текст блока «Дополнительно» рядом с анкетой; пусто — блока нет.
    extraInfo: z.string().trim().max(2000, "Текст слишком длинный — до 2000 символов.").default(""),
    // Подробное описание для свитка «Подробнее»; длина намеренно не ограничена, пусто — свитка нет.
    longDescription: z.string().trim().default(""),
    // Стоимость участия в рублях; пустое поле — участие бесплатное.
    price: z.string().trim().max(20, "Слишком длинная сумма.").default(""),
    status: eventStatusSchema,
  })
  .superRefine((value, ctx) => {
    if (value.price !== "" && !parseRublesToKopecks(value.price)) {
      ctx.addIssue({
        code: "custom",
        path: ["price"],
        message: "Укажите стоимость в рублях больше нуля, например 1500, или оставьте поле пустым — участие бесплатное.",
      });
    }
    if (value.endDate && value.endDate < value.eventDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "Дата окончания не может быть раньше даты начала." });
      return;
    }
    const sameDay = !value.endDate || value.endDate === value.eventDate;
    if (sameDay && value.endTime && value.endTime <= value.startTime) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "Окончание должно быть позже начала. Если мероприятие заканчивается после полуночи, укажите дату окончания.",
      });
    }
  })
  // Окончание в тот же день хранится без даты: так однодневное мероприятие однозначно.
  // Цена — в целых копейках; NULL — бесплатно.
  .transform(({ price, ...value }) => ({
    ...value,
    endDate: value.endDate === value.eventDate ? null : value.endDate,
    priceKopecks: price === "" ? null : parseRublesToKopecks(price),
  }));

export type EventInput = z.infer<typeof eventSchema>;

// ---------- Услуга ----------

export const PRICING_TYPES = ["fixed", "free", "contact"] as const;

const MAX_PRICE_KOPECKS = 10_000_000 * 100;

export const activitySchema = z
  .object({
    title: z.string().trim().min(1, "Укажите название.").max(160, "Название слишком длинное."),
    shortDescription: z.string().trim().max(240, "Краткое описание — до 240 символов."),
    longDescription: z.string().trim().max(3000, "Подробное описание — до 3000 символов."),
    startTime: z
      .string()
      .trim()
      .refine((value) => value === "" || TIME_PATTERN.test(value), "Укажите время в формате ЧЧ:ММ.")
      .transform((value) => (value === "" ? null : value)),
    durationText: optionalText(80, "Длительность — до 80 символов."),
    pricingType: z.enum(PRICING_TYPES, { message: "Выберите тип цены." }),
    price: z.string().trim().max(20),
    priceSuffix: optionalText(80, "Подпись — до 80 символов."),
    details: z
      .string()
      .max(4000)
      .transform((value) =>
        value
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean),
      )
      .refine((lines) => lines.length <= 20, "Не больше 20 пунктов.")
      .refine((lines) => lines.every((line) => line.length <= 200), "Каждый пункт — до 200 символов."),
    isActive: z.boolean(),
  })
  .transform((value, ctx) => {
    // Цена определяется типом: fixed — обязательна, free — 0, contact — отсутствует.
    let fixedPriceKopecks: number | null = null;
    if (value.pricingType === "fixed") {
      const kopecks = parseRublesToKopecks(value.price);
      if (kopecks === null || kopecks <= 0 || kopecks > MAX_PRICE_KOPECKS) {
        ctx.addIssue({ code: "custom", path: ["price"], message: "Укажите цену в рублях больше нуля, например 3500." });
        return z.NEVER;
      }
      fixedPriceKopecks = kopecks;
    } else if (value.pricingType === "free") {
      fixedPriceKopecks = 0;
    }
    const { price: _price, ...rest } = value;
    void _price;
    return { ...rest, fixedPriceKopecks };
  });

export type ActivityInput = z.output<typeof activitySchema>;

// ---------- Общие настройки ----------

export const PAYMENT_METHODS = ["qr", "phone", "both"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Способ оплаты включает QR-код / перевод по номеру телефона. */
export const usesQr = (method: PaymentMethod) => method === "qr" || method === "both";
export const usesPhone = (method: PaymentMethod) => method === "phone" || method === "both";

const phoneDigits = (value: string) => value.replace(/\D/g, "").length;

export const settingsSchema = z
  .object({
    paymentMethod: z.enum(PAYMENT_METHODS, { message: "Выберите способ оплаты." }),
    paymentPhone: z
      .string()
      .trim()
      .max(32, "Номер слишком длинный.")
      .regex(/^[0-9+()\-\s]*$/, "В номере допустимы цифры, пробелы, «+», «-» и скобки.")
      .refine((value) => value === "" || (phoneDigits(value) >= 10 && phoneDigits(value) <= 15), "Укажите номер полностью, например +7 900 000-00-00.")
      .transform((value) => (value === "" ? null : value)),
    paymentRecipient: optionalText(80, "Имя получателя — до 80 символов."),
    paymentTargetUrl: httpsUrl,
    communityTargetUrl: httpsUrl,
    communityVkUrl: httpsUrl,
    communityMaxUrl: httpsUrl,
    communityTitle: z.string().trim().min(1, "Укажите заголовок.").max(120, "Заголовок — до 120 символов."),
    communityDescription: z.string().trim().max(600, "Описание — до 600 символов."),
  })
  // Номер обязателен, если участнику показывается перевод по номеру телефона.
  .superRefine((value, ctx) => {
    if (usesPhone(value.paymentMethod) && !value.paymentPhone) {
      ctx.addIssue({ code: "custom", path: ["paymentPhone"], message: "Укажите номер телефона для перевода." });
    }
  });

export type SettingsInput = z.infer<typeof settingsSchema>;

// ---------- Идентификаторы ----------

export const idSchema = z.coerce.number().int().positive();
export const publicIdSchema = z.uuid();
