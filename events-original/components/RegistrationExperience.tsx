"use client";

import Link from "next/link";
import { FormEvent, InputHTMLAttributes, useMemo, useState, useTransition } from "react";
import { registerParticipant } from "@/app/event/[slug]/actions";
import { activityPriceText } from "@/lib/activity-price";
import { formatRub, paymentSubject } from "@/lib/money";
import type { ActivityView, EventView, ImageAsset, RegistrationReceipt } from "@/lib/types";
import { ActivityCard } from "./ActivityCard";
import { ActivityDetails } from "./ActivityDetails";
import { EventDetailsScroll } from "./EventDetailsScroll";
import { EventPhoto } from "./EventPhoto";
import { EventPoster } from "./EventPoster";

type Props = {
  event: EventView;
  activities: ActivityView[];
  logo: ImageAsset;
  /** Мероприятие прошло: вместо анкеты — «Регистрация закрыта». */
  closed?: boolean;
};

type ParticipantField = "fullName" | "phone" | "messenger";
type Participant = Record<ParticipantField, string>;
type Errors = Partial<Record<ParticipantField, string>>;

const fieldOrder: ParticipantField[] = ["fullName", "phone", "messenger"];
/** Обязательны только ФИО и телефон; мессенджер — по желанию. */
const requiredFields: ParticipantField[] = ["fullName", "phone"];
const emptyParticipant: Participant = { fullName: "", phone: "", messenger: "" };

// Быстрая проверка в браузере для подсказок; окончательную проверку выполняет сервер.
function validateField(field: ParticipantField, value: string): string | undefined {
  const trimmed = value.trim();
  if (field === "fullName" && trimmed.length < 2) return "Укажите фамилию, имя и отчество.";
  if (field === "phone" && trimmed.replace(/\D/g, "").length < 10) return "Укажите телефон полностью, например +7 900 000-00-00.";
  return undefined;
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};

function Field({ id, label, hint, error, ...inputProps }: FieldProps) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`field${error ? " has-error" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...inputProps} />
      {hint && <p className="field-hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="field-error" id={`${id}-error`}>{error}</p>}
    </div>
  );
}

export function RegistrationExperience({ event, activities, logo, closed = false }: Props) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [activeDetails, setActiveDetails] = useState<ActivityView | null>(null);
  const [participant, setParticipant] = useState<Participant>(emptyParticipant);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<RegistrationReceipt | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedActivities = useMemo(
    () => activities.filter((activity) => selectedIds.includes(activity.id)),
    [activities, selectedIds],
  );
  // Предварительный итог для участника; сохраняется сумма, пересчитанная сервером.
  // Участие — обязательная часть, услуги — по выбору.
  const eventPrice = event.priceKopecks ?? 0;
  const hasPaidActivities = selectedActivities.some((activity) => activity.pricingType === "fixed" && (activity.priceKopecks ?? 0) > 0);
  const total =
    eventPrice + selectedActivities.reduce((sum, activity) => sum + (activity.pricingType === "fixed" ? (activity.priceKopecks ?? 0) : 0), 0);
  const fullName = participant.fullName.trim();

  const toggleActivity = (id: number) => {
    if (receipt) return;
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const updateField = (field: ParticipantField, value: string) => {
    setParticipant((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const focusFirstInvalid = (next: Errors) => {
    const firstInvalid = fieldOrder.find((field) => next[field]);
    if (firstInvalid) document.getElementById(`field-${firstInvalid}`)?.focus();
    return !firstInvalid;
  };

  const handleSubmit = (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    if (pending || receipt) return;
    const next: Errors = {};
    for (const field of requiredFields) next[field] = validateField(field, participant[field]);
    setErrors(next);
    setFormError(null);
    if (!focusFirstInvalid(next)) return;

    startTransition(async () => {
      try {
        const result = await registerParticipant(event.slug, { ...participant, activityIds: selectedIds });
        if (result.ok) {
          setReceipt(result.receipt);
          window.requestAnimationFrame(() => document.getElementById("success-state")?.focus());
          return;
        }
        const serverErrors: Errors = {};
        for (const field of fieldOrder) serverErrors[field] = result.fieldErrors?.[field];
        setErrors(serverErrors);
        setFormError(result.message ?? "Не удалось сохранить регистрацию. Попробуйте ещё раз.");
        focusFirstInvalid(serverErrors);
      } catch {
        setFormError("Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.");
      }
    });
  };

  const startNewRegistration = () => {
    setReceipt(null);
    setParticipant(emptyParticipant);
    setSelectedIds([]);
    setErrors({});
    setFormError(null);
    window.requestAnimationFrame(() => document.getElementById("field-fullName")?.focus());
  };

  return (
    <div className="registration-page">
      <header
        className={`hero${event.heroImage ? "" : " no-photo"}${event.heroImage && event.heroFit === "contain" ? " has-poster" : ""}`}
        aria-labelledby="event-title"
      >
        <div className="hero-copy">
          <Link className="back-link hero-back" href="/">
            <span aria-hidden="true">←</span> Назад к списку мероприятий
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src={logo.src} alt={logo.alt} />
          <h1 id="event-title">
            <span className="hero-kicker">{closed ? "Регистрация закрыта" : "Регистрация участников"}</span>
            <span className="hero-title">«{event.title}»</span>
          </h1>
          <dl className="event-facts">
            {event.scheduleFacts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
          {event.description && !closed && <p className="hero-lead">{event.description}</p>}
          {event.longDescription && <EventDetailsScroll title={event.title} text={event.longDescription} />}
        </div>
        {event.heroImage &&
          (event.heroFit === "contain" ? (
            <EventPoster image={event.heroImage} title={event.title} day={event.day} month={event.month} caption={event.locationLabel} closed={closed} />
          ) : (
            <figure className="hero-photo">
              <EventPhoto image={event.heroImage} />
              {event.locationLabel && <figcaption className="photo-caption">{event.locationLabel}</figcaption>}
            </figure>
          ))}
      </header>

      {closed ? (
        <section className="section-shell closed-section" aria-labelledby="closed-title">
          <div className="closed-panel" data-testid="registration-closed">
            <h2 id="closed-title">Мероприятие уже прошло</h2>
            <p>
              «{event.title}» состоялось <span className="nowrap">{event.dateLabel}</span>. Посмотрите ближайшие мероприятия — возможно, вам
              подойдёт другое.
            </p>
            <Link className="button-primary" href="/">
              Ближайшие мероприятия
            </Link>
          </div>
        </section>
      ) : (
        <>
          <form noValidate onSubmit={handleSubmit} aria-label="Анкета регистрации участника">
            <fieldset className="form-fieldset" disabled={!!receipt}>
              <section className="form-step guest-step section-shell" id="registration" aria-labelledby="guest-title">
                <div className="guest-intro">
                  <div className="step-head">
                    <span className="step-number" aria-hidden="true">1</span>
                    <div>
                      <h2 id="guest-title">Данные участника</h2>
                      <p>ФИО и телефон обязательны — по ним мы подтвердим регистрацию и свяжемся с вами. Мессенджер — по желанию.</p>
                    </div>
                  </div>
                  {/* Заголовок постоянный, текст задаёт администратор у мероприятия. */}
                  {event.extraInfo && (
                    <aside className="extra-info" aria-labelledby="extra-info-title" data-testid="extra-info">
                      <h3 id="extra-info-title">Дополнительно</h3>
                      <p>{event.extraInfo}</p>
                    </aside>
                  )}
                </div>
                <div className="guest-fields">
                  <Field
                    id="field-fullName"
                    label="ФИО"
                    name="fullName"
                    type="text"
                    autoComplete="name"
                    placeholder="Иванов Иван Иванович"
                    maxLength={150}
                    value={participant.fullName}
                    onChange={(e) => updateField("fullName", e.target.value)}
                    error={errors.fullName}
                    required
                  />
                  <Field
                    id="field-phone"
                    label="Телефон"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="+7 900 000-00-00"
                    maxLength={32}
                    value={participant.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    error={errors.phone}
                    required
                  />
                  <Field
                    id="field-messenger"
                    label="Мессенджер для связи (необязательно)"
                    name="messenger"
                    type="text"
                    autoComplete="off"
                    placeholder="Telegram: @username"
                    maxLength={120}
                    hint="Если удобнее переписываться, напишите мессенджер и контакт, например «WhatsApp: +7 900 000-00-00»."
                    value={participant.messenger}
                    onChange={(e) => updateField("messenger", e.target.value)}
                    error={errors.messenger}
                  />
                </div>
              </section>

              {activities.length > 0 && (
                <section className="form-step activities-step section-shell" aria-labelledby="activities-title">
                  <div className="step-head step-head-row">
                    <span className="step-number" aria-hidden="true">2</span>
                    <div>
                      <h2 id="activities-title">
                        Дополнительные активности <span className="optional-badge">по желанию</span>
                      </h2>
                      <p>Зарегистрироваться можно и без них. Отметьте то, что хотите добавить к своему дню.</p>
                    </div>
                  </div>
                  <div className="activities-grid" data-count={Math.min(activities.length, 4)}>
                    {activities.map((activity) => (
                      <ActivityCard
                        key={activity.id}
                        activity={activity}
                        selected={selectedIds.includes(activity.id)}
                        onToggle={toggleActivity}
                        onDetails={setActiveDetails}
                      />
                    ))}
                  </div>
                </section>
              )}
            </fieldset>

            {activities.length > 0 && (
              <aside className="day-section section-shell" aria-labelledby="day-title">
                <h2 id="day-title" className="day-title">Ваш день на Рублёвке</h2>
                <ol className="day-line">
                  <li className="day-stop main-stop">
                    <span className="day-dot" aria-hidden="true" />
                    <span className="day-time">{event.timeLabel}</span>
                    <strong>{event.title}</strong>
                    <span>Основная программа</span>
                  </li>
                  {selectedActivities.map((activity) => (
                    <li className="day-stop" key={activity.id}>
                      <span className="day-dot" aria-hidden="true" />
                      <span className="day-time">{activity.time ?? "По согласованию"}</span>
                      <strong>{activity.title}</strong>
                      <span>{activityPriceText(activity)}</span>
                    </li>
                  ))}
                </ol>
                {selectedActivities.length === 0 && (
                  <p className="day-empty">Добавьте активность — и здесь сложится продолжение вашего дня.</p>
                )}
              </aside>
            )}

            <section className="summary-section section-shell" aria-labelledby="summary-title">
              <div className="summary-main">
                {!receipt ? (
                  <>
                    <div className="step-head">
                      <span className="step-number" aria-hidden="true">{activities.length > 0 ? 3 : 2}</span>
                      <div>
                        <h2 id="summary-title">Завершите регистрацию</h2>
                        <p>Проверьте данные перед отправкой.</p>
                      </div>
                    </div>
                    <dl className="summary-list">
                      <div>
                        <dt>Участник</dt>
                        <dd className={fullName ? undefined : "is-empty"}>{fullName || "ФИО пока не указано"}</dd>
                      </div>
                      {eventPrice > 0 && (
                        <div>
                          <dt>Участие</dt>
                          <dd data-testid="summary-event-price">{formatRub(eventPrice)}</dd>
                        </div>
                      )}
                      <div>
                        <dt>Активности</dt>
                        <dd>
                          {selectedActivities.length
                            ? selectedActivities.map((item) => item.title).join(", ")
                            : "Без дополнительных активностей"}
                        </dd>
                      </div>
                      <div>
                        <dt>Итоговая стоимость</dt>
                        <dd className="summary-total" data-testid="summary-total">{formatRub(total)}</dd>
                      </div>
                    </dl>
                    {selectedActivities.some((item) => item.pricingType === "contact") && (
                      <p className="summary-note">Услуги без фиксированной цены в итог не входят — их стоимость уточнит администратор.</p>
                    )}
                    {total > 0 && (
                      <p className="summary-note">
                        Оплатить {paymentSubject(eventPrice, hasPaidActivities)} можно будет сразу после регистрации.
                      </p>
                    )}
                    <div className="register-action">
                      <button className="button-primary submit-button" type="submit" disabled={pending} aria-busy={pending || undefined}>
                        {pending ? "Сохраняем регистрацию…" : "Зарегистрироваться"}
                      </button>
                      {formError && (
                        <p className="field-error" role="alert">
                          {formError}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="success-state" id="success-state" tabIndex={-1} aria-live="polite">
                    <p className="eyebrow">Готово</p>
                    <h2 id="summary-title">Регистрация завершена</h2>
                    <p className="success-event">
                      Вы зарегистрированы на: <strong>«{receipt.eventTitle}»</strong>
                    </p>
                    <dl className="summary-list">
                      <div>
                        <dt>Участник</dt>
                        <dd>{receipt.fullName}</dd>
                      </div>
                      <div>
                        <dt>Контакты</dt>
                        <dd data-testid="receipt-contacts">
                          {receipt.phone}
                          {receipt.messenger ? ` · ${receipt.messenger}` : ""}
                        </dd>
                      </div>
                      {receipt.eventPriceKopecks > 0 && (
                        <div>
                          <dt>Участие</dt>
                          <dd data-testid="receipt-event-price">{formatRub(receipt.eventPriceKopecks)}</dd>
                        </div>
                      )}
                      <div>
                        <dt>Активности</dt>
                        <dd>
                          {receipt.activities.length
                            ? receipt.activities.map((item) => `${item.title} — ${item.priceText}`).join(", ")
                            : "Без дополнительных активностей"}
                        </dd>
                      </div>
                      <div>
                        <dt>Фиксированная стоимость</dt>
                        <dd className="summary-total" data-testid="receipt-total">{formatRub(receipt.totalKopecks)}</dd>
                      </div>
                    </dl>
                    <div className="success-actions">
                      {receipt.totalKopecks > 0 && (
                        <Link className="button-primary" href={`/payment/${receipt.publicId}`}>
                          Оплатить {paymentSubject(receipt.eventPriceKopecks, receipt.hasPaidActivities)}
                        </Link>
                      )}
                      <button className="button-secondary" type="button" onClick={startNewRegistration}>
                        Зарегистрировать ещё одного участника
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </form>

          <ActivityDetails
            activity={activeDetails}
            selected={activeDetails ? selectedIds.includes(activeDetails.id) : false}
            locked={!!receipt}
            onClose={() => setActiveDetails(null)}
            onToggle={toggleActivity}
          />
        </>
      )}
    </div>
  );
}
