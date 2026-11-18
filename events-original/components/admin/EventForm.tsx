"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/app/admin/actions";
import { suggestSlug } from "@/lib/slug";
import { FieldError, FormMessage, ImageInput, submitWithoutReset, SubmitButton } from "./FormParts";

export type EventFormValues = {
  title: string;
  slug: string;
  eventDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  shortDescription: string;
  /** Текст блока «Дополнительно» на странице регистрации. */
  extraInfo: string;
  /** Подробное описание — свиток «Подробнее» в шапке страницы регистрации. */
  longDescription: string;
  locationText: string;
  heroFit: "cover" | "contain";
  /** Стоимость участия в рублях; пусто — бесплатно. */
  price: string;
  status: "draft" | "published" | "archived";
  heroSrc: string | null;
};

type Props = {
  mode: "create" | "edit";
  initial: EventFormValues;
  origin: string;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
};

/**
 * Размеры рамки на сайте: анкета на компьютере — правая половина ≈ 720 × 500 px, на телефоне —
 * полоса во всю ширину ≈ 390 × 170 px; карточка в списке — 16 : 10. Поэтому для «Заполнить рамку»
 * лучше горизонтальное 1600 × 1000 px с главным в центре.
 * «Афиша» не обрезается: высота рамки ≈ 700 px на компьютере и ≈ 480 px на телефоне, ширина — по пропорциям,
 * а на весь экран афиша открывается кнопкой. Поэтому для неё лучше 1080 × 1920 px (9 : 16).
 */
const HERO_FIT_OPTIONS = [
  {
    value: "cover",
    label: "Заполнить рамку — для горизонтальных фото",
    hint: "Лучше всего 1600 × 1000 px (пропорции 16 : 10). Края обрезаются под размер окна — держите главное в центре, без текста у краёв.",
  },
  {
    value: "contain",
    label: "Афиша — для вертикальных афиш и фото",
    hint: "Афиша показывается целиком, без обрезки — в белой рамке на персиковой подложке. Формат 9 : 16, как сторис: лучше всего 1080 × 1920 px. Подойдут и 4 : 5 или 3 : 4. Гость может открыть афишу на весь экран.",
  },
] as const;

const STATUS_OPTIONS = [
  { value: "draft", label: "Черновик", hint: "Видно только в админпанели" },
  { value: "published", label: "Опубликовано", hint: "Регистрация открыта по ссылке" },
  { value: "archived", label: "В архиве", hint: "Скрыто, регистрации сохранены" },
] as const;

export function EventForm({ mode, initial, origin, action }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const [values, setValues] = useState(initial);
  // При создании slug следует за названием, пока администратор не изменит его вручную.
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [picked, setPicked] = useState<{ width: number; height: number; portrait: boolean } | null>(null);
  const errors = state.errors ?? {};

  const set = (key: keyof EventFormValues, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const publicUrl = `${origin}/event/${values.slug || "…"}`;
  const statuses = mode === "create" ? STATUS_OPTIONS.filter((option) => option.value !== "archived") : STATUS_OPTIONS;

  return (
    <form className="a-form" onSubmit={(event) => submitWithoutReset(event, formAction)} noValidate>
      <div className="a-field">
        <label className="a-label" htmlFor="title">
          Название мероприятия
        </label>
        <input
          id="title"
          name="title"
          value={values.title}
          maxLength={160}
          required
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? "title-error" : undefined}
          onChange={(event) => {
            set("title", event.target.value);
            if (!slugTouched) set("slug", suggestSlug(event.target.value));
          }}
        />
        <FieldError id="title-error" message={errors.title} />
      </div>

      <div className="a-field">
        <label className="a-label" htmlFor="slug">
          Адрес страницы (slug)
        </label>
        <input
          id="slug"
          name="slug"
          value={values.slug}
          maxLength={80}
          required
          spellCheck={false}
          autoCapitalize="off"
          aria-invalid={errors.slug ? true : undefined}
          aria-describedby="slug-hint slug-error"
          onChange={(event) => {
            setSlugTouched(true);
            set("slug", event.target.value.toLowerCase());
          }}
        />
        <p className="a-hint" id="slug-hint">
          Публичная ссылка: <span className="a-url">{publicUrl}</span>
          {mode === "edit" && (
            <>
              <br />
              Название можно менять свободно — ссылка останется прежней. Если изменить slug, старая ссылка перестанет работать.
            </>
          )}
        </p>
        <FieldError id="slug-error" message={errors.slug} />
      </div>

      <div className="a-grid-2">
        <div className="a-field">
          <label className="a-label" htmlFor="eventDate">
            Дата начала
          </label>
          <input id="eventDate" name="eventDate" type="date" value={values.eventDate} required onChange={(event) => set("eventDate", event.target.value)} />
          <FieldError id="eventDate-error" message={errors.eventDate} />
        </div>
        <div className="a-field">
          <label className="a-label" htmlFor="startTime">
            Время начала
          </label>
          <input id="startTime" name="startTime" type="time" value={values.startTime} required onChange={(event) => set("startTime", event.target.value)} />
          <FieldError id="startTime-error" message={errors.startTime} />
        </div>
      </div>

      <div className="a-grid-2">
        <div className="a-field">
          <label className="a-label" htmlFor="endDate">
            Дата окончания (необязательно)
          </label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            min={values.eventDate}
            value={values.endDate}
            aria-invalid={errors.endDate ? true : undefined}
            aria-describedby="end-hint endDate-error"
            onChange={(event) => set("endDate", event.target.value)}
          />
          <FieldError id="endDate-error" message={errors.endDate} />
        </div>
        <div className="a-field">
          <label className="a-label" htmlFor="endTime">
            Время окончания (необязательно)
          </label>
          <input
            id="endTime"
            name="endTime"
            type="time"
            value={values.endTime}
            aria-invalid={errors.endTime ? true : undefined}
            aria-describedby="end-hint endTime-error"
            onChange={(event) => set("endTime", event.target.value)}
          />
          <FieldError id="endTime-error" message={errors.endTime} />
        </div>
      </div>
      <p className="a-hint a-hint-tight" id="end-hint">
        В один день — укажите только время окончания: на сайте будет «17:00 – 23:00». Если мероприятие заканчивается после полуночи или
        длится несколько дней — укажите и дату окончания.
      </p>

      <div className="a-field">
        <label className="a-label" htmlFor="price">
          Стоимость участия, ₽ (необязательно)
        </label>
        <input
          id="price"
          name="price"
          inputMode="decimal"
          placeholder="Бесплатно"
          className="a-input-short"
          maxLength={20}
          value={values.price}
          aria-invalid={errors.price ? true : undefined}
          aria-describedby="price-hint price-error"
          onChange={(event) => set("price", event.target.value)}
        />
        <p className="a-hint" id="price-hint">
          Пусто — участие бесплатное. Если указать сумму, она обязательна для каждого участника и входит в итог вместе с выбранными
          услугами. Уже сделанные регистрации сохраняют стоимость, которая была при регистрации.
        </p>
        <FieldError id="price-error" message={errors.price} />
      </div>

      <div className="a-field">
        <label className="a-label" htmlFor="shortDescription">
          Краткое описание под названием
        </label>
        <textarea
          id="shortDescription"
          name="shortDescription"
          rows={3}
          maxLength={400}
          value={values.shortDescription}
          onChange={(event) => set("shortDescription", event.target.value)}
        />
        <FieldError id="shortDescription-error" message={errors.shortDescription} />
      </div>

      <div className="a-field">
        <label className="a-label" htmlFor="extraInfo">
          Блок «Дополнительно» рядом с анкетой (необязательно)
        </label>
        <textarea
          id="extraInfo"
          name="extraInfo"
          rows={5}
          maxLength={2000}
          placeholder={"Например: возьмите с собой тёплую одежду.\nЗаезд на территорию — с 16:00."}
          value={values.extraInfo}
          aria-invalid={errors.extraInfo ? true : undefined}
          aria-describedby="extraInfo-hint extraInfo-error"
          onChange={(event) => set("extraInfo", event.target.value)}
        />
        <p className="a-hint" id="extraInfo-hint">
          Показывается под заголовком «Дополнительно» слева от полей ФИО и телефона. Переносы строк сохраняются. Пусто — блок не
          показывается.
        </p>
        <FieldError id="extraInfo-error" message={errors.extraInfo} />
      </div>

      <div className="a-field">
        <label className="a-label" htmlFor="longDescription">
          Подробное описание — свиток «Подробнее» (необязательно)
        </label>
        {/* Длина не ограничена: свиток на сайте разворачивается под любой объём текста. */}
        <textarea
          id="longDescription"
          name="longDescription"
          rows={10}
          placeholder={"Например: программа вечера по часам, что входит в стоимость, как добраться.\n\nПустая строка между абзацами сохраняется."}
          value={values.longDescription}
          aria-invalid={errors.longDescription ? true : undefined}
          aria-describedby="longDescription-hint longDescription-error"
          onChange={(event) => set("longDescription", event.target.value)}
        />
        <p className="a-hint" id="longDescription-hint">
          В шапке страницы регистрации появится свёрнутый свиток «Подробнее». Гость нажимает на него — свиток разворачивается во всю
          длину текста. Длина не ограничена, абзацы и переносы строк сохраняются. Пусто — свитка нет.
        </p>
        <FieldError id="longDescription-error" message={errors.longDescription} />
      </div>

      <div className="a-field">
        <label className="a-label" htmlFor="locationText">
          Подпись на фотографии (место)
        </label>
        <input
          id="locationText"
          name="locationText"
          maxLength={120}
          placeholder="На берегу Волги · Краснослободск"
          value={values.locationText}
          onChange={(event) => set("locationText", event.target.value)}
        />
        <FieldError id="locationText-error" message={errors.locationText} />
      </div>

      <ImageInput
        name="heroImage"
        label="Главная фотография"
        hint="JPEG, PNG или WebP до 10 МБ. Фото будет уменьшено и оптимизировано автоматически."
        currentSrc={initial.heroSrc}
        removable={mode === "edit"}
        removeName="removeHero"
        error={errors.heroImage}
        previewFit={values.heroFit}
        onSelect={(file) => {
          setPicked(null);
          if (!file) return;
          // Размер выбранного фото: администратор видит, подходит ли оно, а вертикальное
          // сразу переключается в режим «Афиша».
          const url = URL.createObjectURL(file);
          const image = new Image();
          image.onload = () => {
            const portrait = image.naturalHeight > image.naturalWidth;
            setPicked({ width: image.naturalWidth, height: image.naturalHeight, portrait });
            if (portrait) set("heroFit", "contain");
            URL.revokeObjectURL(url);
          };
          image.onerror = () => URL.revokeObjectURL(url);
          image.src = url;
        }}
      />
      {picked && (
        <p className="a-hint a-hint-tight" data-testid="hero-size" role="status">
          Выбрано фото {picked.width} × {picked.height} px
          {picked.portrait ? " — вертикальное, включён режим «Афиша»." : "."}
        </p>
      )}

      <fieldset className="a-field a-radio-group">
        <legend className="a-label">Как показывать фото</legend>
        {HERO_FIT_OPTIONS.map((option) => (
          <label key={option.value} className={`a-radio${values.heroFit === option.value ? " is-checked" : ""}`}>
            <input type="radio" name="heroFit" value={option.value} checked={values.heroFit === option.value} onChange={() => set("heroFit", option.value)} />
            <span>
              <strong>{option.label}</strong>
              <small>{option.hint}</small>
            </span>
          </label>
        ))}
        <FieldError id="heroFit-error" message={errors.heroFit} />
      </fieldset>

      <fieldset className="a-field a-radio-group">
        <legend className="a-label">Статус</legend>
        {statuses.map((option) => (
          <label key={option.value} className={`a-radio${values.status === option.value ? " is-checked" : ""}`}>
            <input type="radio" name="status" value={option.value} checked={values.status === option.value} onChange={() => set("status", option.value)} />
            <span>
              <strong>{option.label}</strong>
              <small>{option.hint}</small>
            </span>
          </label>
        ))}
        <FieldError id="status-error" message={errors.status} />
      </fieldset>

      <FormMessage state={state} />
      <div className="a-form-actions">
        <SubmitButton pendingText="Сохраняем…" pending={pending}>{mode === "create" ? "Создать мероприятие" : "Сохранить изменения"}</SubmitButton>
      </div>
    </form>
  );
}
