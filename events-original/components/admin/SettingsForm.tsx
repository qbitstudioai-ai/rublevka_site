"use client";

import { useActionState, useState } from "react";
import { saveSettingsAction, type ActionState } from "@/app/admin/actions";
import { PlatformIcon } from "../PlatformIcon";
import { FieldError, FormMessage, ImageInput, submitWithoutReset, SubmitButton } from "./FormParts";

export type PaymentMethod = "qr" | "phone" | "both";

export type SettingsFormValues = {
  paymentMethod: PaymentMethod;
  paymentPhone: string;
  paymentRecipient: string;
  paymentQrSrc: string | null;
  paymentTargetUrl: string;
  communityQrSrc: string | null;
  communityTargetUrl: string;
  communityVkUrl: string;
  communityMaxUrl: string;
  communityTitle: string;
  communityDescription: string;
};

/** Поля ссылок на сообщества; Telegram хранится в прежней колонке community_target_url. */
const COMMUNITY_LINKS = [
  { name: "communityTargetUrl", platform: "telegram", label: "Telegram", placeholder: "https://t.me/…" },
  { name: "communityVkUrl", platform: "vk", label: "VK", placeholder: "https://vk.ru/…" },
  { name: "communityMaxUrl", platform: "max", label: "MAX", placeholder: "https://max.ru/…" },
] as const;

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; hint: string }[] = [
  { value: "qr", label: "QR-код", hint: "Участник сканирует QR камерой телефона" },
  { value: "phone", label: "Номер телефона", hint: "Перевод по номеру в приложении банка" },
  { value: "both", label: "QR-код и номер телефона", hint: "Участник выбирает удобный способ" },
];

export function SettingsForm({ initial }: { initial: SettingsFormValues }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveSettingsAction, {});
  const [values, setValues] = useState(initial);
  const errors = state.errors ?? {};
  const set = (key: keyof SettingsFormValues, value: string) => setValues((current) => ({ ...current, [key]: value }));

  return (
    <form className="a-form" onSubmit={(event) => submitWithoutReset(event, action)} noValidate>
      <section className="a-form-section" aria-labelledby="settings-payment">
        <h2 id="settings-payment">Оплата</h2>
        <p className="a-hint">Одни реквизиты для всех мероприятий и услуг. Участник сам вводит сумму и указывает ФИО в сообщении к платежу.</p>
        <fieldset className="a-field a-radio-group">
          <legend className="a-label">Что показать участнику для оплаты</legend>
          {PAYMENT_OPTIONS.map((option) => (
            <label key={option.value} className={`a-radio${values.paymentMethod === option.value ? " is-checked" : ""}`}>
              <input
                type="radio"
                name="paymentMethod"
                value={option.value}
                checked={values.paymentMethod === option.value}
                onChange={() => set("paymentMethod", option.value)}
              />
              <span>
                <strong>{option.label}</strong>
                <small>{option.hint}</small>
              </span>
            </label>
          ))}
          <FieldError id="paymentMethod-error" message={errors.paymentMethod} />
        </fieldset>

        {values.paymentMethod !== "phone" && (
          <ImageInput
            name="paymentQr"
            label="QR-код оплаты"
            hint="Фото или скриншот QR-кода: JPEG, PNG или WebP до 10 МБ. Сохраняется без потери качества."
            currentSrc={initial.paymentQrSrc}
            accept="image/png,image/webp,image/jpeg"
            error={errors.paymentQr}
            square
          />
        )}

        {values.paymentMethod !== "qr" && (
          <div className="a-grid-2">
            <div className="a-field">
              <label className="a-label" htmlFor="paymentPhone">
                Номер телефона для перевода
              </label>
              <input
                id="paymentPhone"
                name="paymentPhone"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="+7 900 000-00-00"
                maxLength={32}
                value={values.paymentPhone}
                onChange={(e) => set("paymentPhone", e.target.value)}
                aria-invalid={errors.paymentPhone ? true : undefined}
              />
              <FieldError id="paymentPhone-error" message={errors.paymentPhone} />
            </div>
            <div className="a-field">
              <label className="a-label" htmlFor="paymentRecipient">
                Получатель (необязательно)
              </label>
              <input
                id="paymentRecipient"
                name="paymentRecipient"
                maxLength={80}
                placeholder="Иван Иванович И."
                value={values.paymentRecipient}
                onChange={(e) => set("paymentRecipient", e.target.value)}
              />
              <p className="a-hint">Как имя отображается в банке — участник сверит его перед переводом.</p>
              <FieldError id="paymentRecipient-error" message={errors.paymentRecipient} />
            </div>
          </div>
        )}
        {/* Скрытые поля сохраняют значения, если способ временно переключён. */}
        {values.paymentMethod === "qr" && (
          <>
            <input type="hidden" name="paymentPhone" value={values.paymentPhone} />
            <input type="hidden" name="paymentRecipient" value={values.paymentRecipient} />
          </>
        )}
        <div className="a-field">
          <label className="a-label" htmlFor="paymentTargetUrl">
            Ссылка для кнопки «Открыть Сбербанк» (необязательно)
          </label>
          <input
            id="paymentTargetUrl"
            name="paymentTargetUrl"
            type="url"
            inputMode="url"
            placeholder="https://"
            value={values.paymentTargetUrl}
            onChange={(e) => set("paymentTargetUrl", e.target.value)}
            aria-invalid={errors.paymentTargetUrl ? true : undefined}
          />
          <p className="a-hint">Нужна тем, кто открыл страницу оплаты с телефона и не может отсканировать собственный экран. Без ссылки кнопка не показывается.</p>
          <FieldError id="paymentTargetUrl-error" message={errors.paymentTargetUrl} />
        </div>
      </section>

      <section className="a-form-section" aria-labelledby="settings-community">
        <h2 id="settings-community">Сообщества</h2>
        <p className="a-hint">Блок внизу публичных страниц. Кнопка платформы показывается, только если указана её ссылка; без ссылок и QR блок скрыт.</p>
        <ImageInput
          name="communityQr"
          label="QR-код Telegram-сообщества"
          hint="PNG, WebP или JPEG до 10 МБ. Показывается справа от кнопок платформ."
          currentSrc={initial.communityQrSrc}
          accept="image/png,image/webp,image/jpeg"
          square
        />
        {COMMUNITY_LINKS.map((link) => (
          <div className="a-field" key={link.name}>
            <label className="a-label" htmlFor={link.name}>
              Ссылка на {link.label} (необязательно)
            </label>
            <input
              id={link.name}
              name={link.name}
              type="url"
              inputMode="url"
              placeholder={link.placeholder}
              value={values[link.name]}
              onChange={(e) => set(link.name, e.target.value)}
              aria-invalid={errors[link.name] ? true : undefined}
            />
            <FieldError id={`${link.name}-error`} message={errors[link.name]} />
          </div>
        ))}
        <div className="a-field">
          <label className="a-label" htmlFor="communityTitle">
            Заголовок блока
          </label>
          <input id="communityTitle" name="communityTitle" maxLength={120} required value={values.communityTitle} onChange={(e) => set("communityTitle", e.target.value)} />
          <FieldError id="communityTitle-error" message={errors.communityTitle} />
        </div>
        <div className="a-field">
          <label className="a-label" htmlFor="communityDescription">
            Текст блока
          </label>
          <textarea
            id="communityDescription"
            name="communityDescription"
            rows={3}
            maxLength={600}
            value={values.communityDescription}
            onChange={(e) => set("communityDescription", e.target.value)}
          />
          <FieldError id="communityDescription-error" message={errors.communityDescription} />
        </div>

        <div className="a-preview" aria-label="Предпросмотр блока сообщества">
          <p className="a-preview-label">Предпросмотр</p>
          <div className="a-preview-community">
            <div>
              <strong>{values.communityTitle || "Заголовок"}</strong>
              {values.communityDescription && <p>{values.communityDescription}</p>}
            </div>
            <div className="a-preview-platforms">
              {COMMUNITY_LINKS.filter((link) => values[link.name].trim()).map((link) => (
                <span className="a-preview-platform" key={link.name}>
                  <PlatformIcon platform={link.platform} />
                  {link.label}
                </span>
              ))}
            </div>
            {initial.communityQrSrc && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={initial.communityQrSrc} alt="" />
            )}
          </div>
        </div>
      </section>

      <FieldError id="files-error" message={errors.files} />
      <FormMessage state={state} />
      <div className="a-form-actions">
        <SubmitButton pendingText="Сохраняем…" pending={pending}>Сохранить настройки</SubmitButton>
      </div>
    </form>
  );
}
