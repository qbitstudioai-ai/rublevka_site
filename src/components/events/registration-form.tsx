"use client";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { submitRegistration } from "@/app/(public)/meropriyatiya/[slug]/actions";
import { MediaFrame } from "@/components/ui/media-frame";
import {
  dayPlan,
  displayPrice,
  eventDate,
  mediaId,
  money,
  planTime,
} from "./presentation";

type Option = {
  id: string;
  title: string;
  description: string;
  imageId: string | null;
  startsAt: Date | null;
  price: number | null;
  available: boolean;
  required: boolean;
};
type Props = {
  event: {
    id: string;
    title: string;
    startsAt: Date;
    endsAt: Date;
    price: number | null;
    group: boolean;
  };
  options: Option[];
  enabled: boolean;
  requestId: string;
};
export function RegistrationForm({
  event,
  options,
  enabled,
  requestId,
}: Props) {
  const [selection, setSelection] = useState(() =>
    options.filter((o) => o.required && o.available).map((o) => o.id),
  );
  const [details, setDetails] = useState({
    name: "",
    phone: "",
    messenger: "",
    consent: false,
  });
  const [state, submit, pending] = useActionState(
    submitRegistration.bind(null, event.id, requestId),
    null,
  );
  const summary = useRef<HTMLHeadingElement>(null),
    errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state && "receipt" in state) summary.current?.focus();
    if (state && "error" in state) errorRef.current?.focus();
  }, [state]);
  const selected = options.filter((o) => selection.includes(o.id)),
    plan = dayPlan(event, selected);
  if (state && "receipt" in state)
    return (
      <section className="fest-receipt" aria-labelledby="receipt-title">
        <span className="guide-birds" aria-hidden="true" />
        <p className="fest-kicker">Именное приглашение</p>
        <h2 id="receipt-title" ref={summary} tabIndex={-1}>
          Заявка принята
        </h2>
        <p className="fest-receipt-name">{state.receipt.name}</p>
        <h3>{event.title}</h3>
        <p>{eventDate(event.startsAt, event.endsAt)}</p>
        <p>
          Номер регистрации{" "}
          <strong className="fest-reference">{state.receipt.id}</strong>
        </p>
        <p>
          Предварительная стоимость · {money(state.receipt.total)}
          {state.receipt.hasQuote ? " + услуги по запросу" : ""}
        </p>
        <p>
          В тестовой базе сохранена заявка. При открытии регистрации условия
          участия подтвердит администратор.
        </p>
        <Link href="/meropriyatiya">Вернуться к афише →</Link>
      </section>
    );
  return (
    <form id="event-registration" action={submit} className="fest-form">
      {options.length > 0 && (
        <fieldset className="fest-options">
          <legend>Дополнительные активности</legend>
          <div className="fest-option-grid">
            {options.map((option) => {
              const photo = mediaId(option.imageId),
                checked = selection.includes(option.id);
              return (
                <label
                  key={option.id}
                  className="fest-option"
                  data-selected={checked}
                  aria-disabled={!option.available || undefined}
                >
                  <input
                    type="checkbox"
                    name="activity"
                    value={option.id}
                    checked={checked}
                    disabled={!option.available || option.required || pending}
                    onChange={(e) =>
                      setSelection(
                        e.target.checked
                          ? [...selection, option.id]
                          : selection.filter((id) => id !== option.id),
                      )
                    }
                  />
                  {option.required && option.available && (
                    <input type="hidden" name="activity" value={option.id} />
                  )}
                  <span>
                    {photo && (
                      <MediaFrame
                        mediaId={photo}
                        sizes="(max-width: 680px) 90vw, 22vw"
                      />
                    )}
                    <strong>{option.title}</strong>
                    <span>{option.description}</span>
                    <small>
                      {planTime(option.startsAt, event.startsAt)} ·{" "}
                      {displayPrice(option.price)}
                    </small>
                    {(!option.available || option.required) && (
                      <small>
                        {!option.available
                          ? "Запись недоступна"
                          : "Входит в программу"}
                      </small>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
      <div className="fest-register-grid">
        <section className="fest-agenda" aria-labelledby="day-heading">
          <h2 id="day-heading">Ваш день на Рублевке</h2>
          <ol aria-live="polite">
            {plan.entries.map((entry) => (
              <li key={entry.id ?? event.id}>
                <time dateTime={entry.startsAt?.toISOString()}>
                  {planTime(entry.startsAt, event.startsAt)}
                </time>
                <strong>{entry.title}</strong>
                <small>{displayPrice(entry.price)}</small>
              </li>
            ))}
          </ol>
          <div className="fest-total" aria-live="polite">
            <span>Предварительная стоимость</span>
            <strong>{money(plan.total)}</strong>
            {plan.hasQuote && (
              <small>Услуги по запросу рассчитываются отдельно.</small>
            )}
          </div>
        </section>
        <section className="fest-guest" aria-labelledby="guest-heading">
          <h2 id="guest-heading">
            {event.group ? "Обращение организатора" : "Регистрация участника"}
          </h2>
          {enabled ? (
            <>
              <p>
                Тестовая регистрация. Используйте вымышленные имя и контакты.
              </p>
              {event.group && (
                <p>
                  Укажите данные взрослого организатора группы. Сведения о детях
                  не требуются.
                </p>
              )}
              <label>
                {event.group ? "ФИО взрослого организатора" : "ФИО"}
                <input
                  name="name"
                  autoComplete="off"
                  required
                  minLength={2}
                  maxLength={120}
                  value={details.name}
                  onChange={(e) =>
                    setDetails({ ...details, name: e.target.value })
                  }
                />
              </label>
              <label>
                Телефон
                <input
                  type="tel"
                  autoComplete="off"
                  name="phone"
                  required
                  minLength={10}
                  maxLength={25}
                  value={details.phone}
                  onChange={(e) =>
                    setDetails({ ...details, phone: e.target.value })
                  }
                  pattern="[+0-9\s\(\)\-]{10,25}"
                  title="Введите номер с кодом страны или города"
                />
              </label>
              <label>
                Мессенджер (необязательно)
                <input
                  name="messenger"
                  maxLength={100}
                  autoComplete="off"
                  value={details.messenger}
                  onChange={(e) =>
                    setDetails({ ...details, messenger: e.target.value })
                  }
                />
              </label>
              <label className="fest-consent">
                <input
                  type="checkbox"
                  required
                  name="consent"
                  value="yes"
                  checked={details.consent}
                  onChange={(e) =>
                    setDetails({ ...details, consent: e.target.checked })
                  }
                />
                <span>
                  Даю согласие на обработку указанных данных для тестовой
                  регистрации на мероприятие.
                </span>
              </label>
              {state && "error" in state && (
                <p ref={errorRef} tabIndex={-1} role="alert">
                  {state.error}
                </p>
              )}
              <button className="guide-action" type="submit" disabled={pending}>
                {pending ? "Сохраняем заявку…" : "Отправить заявку"}
              </button>
            </>
          ) : (
            <>
              <p>Приём заявок на сайте пока закрыт.</p>
              <Link href="/kontakty">Связаться с администрацией →</Link>
            </>
          )}
        </section>
      </div>
    </form>
  );
}
