import { expect, test } from "@playwright/test";
import { getPublicSettings } from "@/lib/server/public-data";
import { getSettings, updateSettings } from "@/lib/server/repo/settings";
import { settingsSchema } from "@/lib/server/validation";
import { freshDb } from "./helpers";

const base = {
  paymentMethod: "qr",
  paymentPhone: "",
  paymentRecipient: "",
  paymentTargetUrl: "",
  communityTargetUrl: "",
  communityVkUrl: "",
  communityMaxUrl: "",
  communityTitle: "Сообщество",
  communityDescription: "",
};

const errorsOf = (input: Record<string, string>) => {
  const result = settingsSchema.safeParse({ ...base, ...input });
  return result.success ? {} : Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
};

test.describe("способы оплаты", () => {
  test("номер обязателен для «телефон» и «оба», проверяется формат", () => {
    expect(errorsOf({ paymentMethod: "qr" })).toEqual({});
    expect(errorsOf({ paymentMethod: "phone" })).toEqual({ paymentPhone: "Укажите номер телефона для перевода." });
    expect(errorsOf({ paymentMethod: "both" })).toEqual({ paymentPhone: "Укажите номер телефона для перевода." });
    expect(errorsOf({ paymentMethod: "phone", paymentPhone: "12345" })).toHaveProperty("paymentPhone");
    expect(errorsOf({ paymentMethod: "phone", paymentPhone: "+7 900 000-00-00; DROP" })).toHaveProperty("paymentPhone");
    expect(errorsOf({ paymentMethod: "phone", paymentPhone: "+7 (900) 123-45-67" })).toEqual({});
    expect(errorsOf({ paymentMethod: "card" })).toHaveProperty("paymentMethod");
  });

  test("миграция: по умолчанию QR — поведение прежних установок не меняется", () => {
    const { db } = freshDb();
    expect(getSettings(db)).toMatchObject({ payment_method: "qr", payment_phone: null, payment_recipient: null });
  });

  test("публичная модель показывает только выбранные способы", () => {
    const { db } = freshDb();
    db.prepare("UPDATE app_settings SET payment_qr_image = '/mock/qr-payment-demo.svg' WHERE id = 1").run();
    const save = (input: Record<string, string>) => updateSettings(db, settingsSchema.parse({ ...base, ...input }), {});

    save({ paymentMethod: "qr", paymentPhone: "+7 900 123-45-67", paymentRecipient: "Иван И." });
    // Номер сохранён, но участнику не показывается.
    expect(getSettings(db)).toMatchObject({ payment_method: "qr", payment_phone: "+7 900 123-45-67" });
    expect(getPublicSettings(db).payment).toMatchObject({ method: "qr", phone: null, recipient: null, qr: { src: "/meropriyatiya/mock/qr-payment-demo.svg" } });

    save({ paymentMethod: "phone", paymentPhone: "+7 900 123-45-67", paymentRecipient: "Иван И." });
    expect(getPublicSettings(db).payment).toMatchObject({ method: "phone", phone: "+7 900 123-45-67", recipient: "Иван И.", qr: null });
    // QR-файл при этом не удаляется — можно вернуться к нему без повторной загрузки.
    expect(getSettings(db).payment_qr_image).toBe("/mock/qr-payment-demo.svg");

    save({ paymentMethod: "both", paymentPhone: "+7 900 123-45-67" });
    expect(getPublicSettings(db).payment).toMatchObject({ method: "both", phone: "+7 900 123-45-67", recipient: null, qr: { src: "/meropriyatiya/mock/qr-payment-demo.svg" } });

    // База не принимает неизвестный способ.
    expect(() => db.prepare("UPDATE app_settings SET payment_method = 'card' WHERE id = 1").run()).toThrow(/CHECK/);
  });
});
