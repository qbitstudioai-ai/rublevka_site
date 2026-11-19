"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/app/admin/actions";
import type { PricingType } from "@/lib/money";
import { FieldError, FormMessage, ImageInput, MAX_FILE_BYTES, MAX_FORM_FILES_BYTES, submitWithoutReset, SubmitButton } from "./FormParts";

export type ActivityFormValues = {
  title: string;
  shortDescription: string;
  longDescription: string;
  startTime: string;
  durationText: string;
  pricingType: PricingType;
  price: string;
  priceSuffix: string;
  details: string;
  isActive: boolean;
  cardSrc: string | null;
  gallery: { id: number; src: string }[];
};

type Props = {
  mode: "create" | "edit";
  initial: ActivityFormValues;
  cancelHref: string;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
};

const PRICING = [
  { value: "fixed", label: "Фиксированная цена", hint: "Входит в итоговую сумму и оплату" },
  { value: "free", label: "Бесплатно", hint: "Цена не нужна" },
  { value: "contact", label: "По согласованию", hint: "Стоимость сообщит администратор" },
] as const;

const SUFFIX_LABEL: Record<PricingType, { label: string; placeholder: string }> = {
  fixed: { label: "Подпись после цены (необязательно)", placeholder: "за компанию" },
  free: { label: "Подпись после «Бесплатно» (необязательно)", placeholder: "для детей до 7 лет" },
  contact: { label: "Подпись вместо цены", placeholder: "Стоимость уточнит администратор" },
};

export function ActivityForm({ mode, initial, cancelHref, action }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const [values, setValues] = useState(initial);
  const [clientError, setClientError] = useState<string | null>(null);
  const errors = state.errors ?? {};
  const set = <K extends keyof ActivityFormValues>(key: K, value: ActivityFormValues[K]) => setValues((current) => ({ ...current, [key]: value }));

  return (
    <form
      className="a-form"
      noValidate
      onSubmit={(event) => {
        // Проверяем объём файлов до отправки, чтобы не упереться в лимит запроса.
        const files = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement>('input[type="file"]')).flatMap((input) => Array.from(input.files ?? []));
        const tooBig = files.find((file) => file.size > MAX_FILE_BYTES);
        const total = files.reduce((sum, file) => sum + file.size, 0);
        if (tooBig || total > MAX_FORM_FILES_BYTES) {
          event.preventDefault();
          setClientError(tooBig ? `Файл «${tooBig.name}» больше 10 МБ.` : "Слишком много фотографий за один раз: сохраните их в несколько приёмов.");
          return;
        }
        setClientError(null);
        submitWithoutReset(event, formAction);
      }}
    >
      <section className="a-form-section" aria-labelledby="activity-main">
        <h2 id="activity-main">Описание</h2>
        <div className="a-field">
          <label className="a-label" htmlFor="title">
            Название
          </label>
          <input id="title" name="title" maxLength={160} required value={values.title} onChange={(e) => set("title", e.target.value)} aria-invalid={errors.title ? true : undefined} />
          <FieldError id="title-error" message={errors.title} />
        </div>
        <div className="a-field">
          <label className="a-label" htmlFor="shortDescription">
            Краткое описание на карточке
          </label>
          <input id="shortDescription" name="shortDescription" maxLength={240} value={values.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} />
          <FieldError id="shortDescription-error" message={errors.shortDescription} />
        </div>
        <div className="a-field">
          <label className="a-label" htmlFor="longDescription">
            Подробное описание
          </label>
          <textarea id="longDescription" name="longDescription" rows={4} maxLength={3000} value={values.longDescription} onChange={(e) => set("longDescription", e.target.value)} />
          <FieldError id="longDescription-error" message={errors.longDescription} />
        </div>
        <div className="a-field">
          <label className="a-label" htmlFor="details">
            Пункты подробностей
          </label>
          <textarea
            id="details"
            name="details"
            rows={4}
            value={values.details}
            onChange={(e) => set("details", e.target.value)}
            aria-describedby="details-hint"
          />
          <p className="a-hint" id="details-hint">
            Каждый пункт — с новой строки: что включено, ограничения, условия.
          </p>
          <FieldError id="details-error" message={errors.details} />
        </div>
        <div className="a-grid-2">
          <div className="a-field">
            <label className="a-label" htmlFor="startTime">
              Время начала (необязательно)
            </label>
            <input id="startTime" name="startTime" type="time" value={values.startTime} onChange={(e) => set("startTime", e.target.value)} />
            <FieldError id="startTime-error" message={errors.startTime} />
          </div>
          <div className="a-field">
            <label className="a-label" htmlFor="durationText">
              Длительность (необязательно)
            </label>
            <input id="durationText" name="durationText" maxLength={80} placeholder="около 90 минут" value={values.durationText} onChange={(e) => set("durationText", e.target.value)} />
            <FieldError id="durationText-error" message={errors.durationText} />
          </div>
        </div>
      </section>

      <section className="a-form-section" aria-labelledby="activity-price">
        <h2 id="activity-price">Стоимость</h2>
        <fieldset className="a-field a-radio-group">
          <legend className="a-label">Тип цены</legend>
          {PRICING.map((option) => (
            <label key={option.value} className={`a-radio${values.pricingType === option.value ? " is-checked" : ""}`}>
              <input type="radio" name="pricingType" value={option.value} checked={values.pricingType === option.value} onChange={() => set("pricingType", option.value)} />
              <span>
                <strong>{option.label}</strong>
                <small>{option.hint}</small>
              </span>
            </label>
          ))}
        </fieldset>
        {values.pricingType === "fixed" && (
          <div className="a-field">
            <label className="a-label" htmlFor="price">
              Цена, ₽
            </label>
            <input
              id="price"
              name="price"
              inputMode="decimal"
              required
              placeholder="3500"
              className="a-input-short"
              value={values.price}
              onChange={(e) => set("price", e.target.value)}
              aria-invalid={errors.price ? true : undefined}
            />
            <FieldError id="price-error" message={errors.price} />
          </div>
        )}
        <div className="a-field">
          <label className="a-label" htmlFor="priceSuffix">
            {SUFFIX_LABEL[values.pricingType].label}
          </label>
          <input
            id="priceSuffix"
            name="priceSuffix"
            maxLength={80}
            placeholder={SUFFIX_LABEL[values.pricingType].placeholder}
            value={values.priceSuffix}
            onChange={(e) => set("priceSuffix", e.target.value)}
          />
          <FieldError id="priceSuffix-error" message={errors.priceSuffix} />
        </div>
      </section>

      <section className="a-form-section" aria-labelledby="activity-photos">
        <h2 id="activity-photos">Фотографии</h2>
        <ImageInput
          name="cardImage"
          label="Фото карточки"
          hint="JPEG, PNG или WebP до 10 МБ."
          currentSrc={initial.cardSrc}
          removable={mode === "edit"}
          removeName="removeCard"
        />
        <div className="a-field">
          <span className="a-label">Галерея в окне «Подробнее»</span>
          {values.gallery.length > 0 ? (
            <ul className="a-gallery">
              {values.gallery.map((image, index) => (
                <li key={image.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.src} alt={`Фотография галереи ${index + 1}`} />
                  <label className="a-check">
                    <input type="checkbox" name="removeGallery" value={image.id} /> Удалить
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="a-hint">В галерее пока нет фотографий — в окне «Подробнее» будет показано фото карточки.</p>
          )}
          <label className="a-label a-label-secondary" htmlFor="gallery">
            Добавить фотографии (до 6 за раз)
          </label>
          <input id="gallery" name="gallery" type="file" multiple accept="image/jpeg,image/png,image/webp" />
          <FieldError id="gallery-error" message={errors.gallery} />
        </div>
        <FieldError id="files-error" message={clientError ?? errors.files} />
      </section>

      <section className="a-form-section" aria-labelledby="activity-visibility">
        <h2 id="activity-visibility">Показ</h2>
        <label className="a-check a-check-large">
          <input type="checkbox" name="isActive" checked={values.isActive} onChange={(e) => set("isActive", e.target.checked)} />
          <span>
            <strong>Показывать участникам</strong>
            <small>Выключенная услуга скрыта из анкеты, но сохраняется вместе с историей регистраций.</small>
          </span>
        </label>
      </section>

      <FormMessage state={state} />
      <div className="a-form-actions">
        <SubmitButton pendingText="Сохраняем…" pending={pending}>{mode === "create" ? "Добавить услугу" : "Сохранить услугу"}</SubmitButton>
        <a className="a-button a-button-quiet" href={"/meropriyatiya" + cancelHref}>
          Отмена
        </a>
      </div>
    </form>
  );
}
