import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CopyPhoneButton } from "@/components/CopyPhoneButton";
import { PublicSiteHeader } from "@/components/PublicSiteHeader";
import { BRAND_LOGO, PAYMENT_BANK_NAME } from "@/lib/brand";
import { formatEventDate } from "@/lib/format";
import { formatRub, paymentHeading } from "@/lib/money";
import { getDb } from "@/lib/server/db";
import { getPublicSettings } from "@/lib/server/public-data";
import { getEventById } from "@/lib/server/repo/events";
import { getRegistrationByPublicId } from "@/lib/server/repo/registrations";
import { publicIdSchema } from "@/lib/server/validation";

export const metadata: Metadata = {
  title: "Оплата — Рублёвка",
  description: "Оплата дополнительных услуг мероприятия по QR-коду или по номеру телефона.",
  // Персональная страница: не индексировать и не передавать адрес третьим сайтам.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type PageProps = {
  params: Promise<{ publicId: string }>;
};

/**
 * Оплата доступна только после регистрации: сумма, ФИО и состав услуг
 * берутся из сохранённой регистрации и её snapshots, а не из адреса страницы.
 */
export default async function PaymentPage({ params }: PageProps) {
  await connection();
  const parsedId = publicIdSchema.safeParse((await params).publicId);
  if (!parsedId.success) notFound();

  const db = getDb();
  const registration = getRegistrationByPublicId(db, parsedId.data);
  if (!registration) notFound();
  const event = getEventById(db, registration.event_id);
  if (!event) notFound();

  const { payment } = getPublicSettings(db);
  const total = registration.fixed_total_kopecks;
  // Первый шаг инструкции зависит от способа, выбранного в админпанели.
  const openBank = payment.url ? ` или нажмите кнопку «Открыть ${PAYMENT_BANK_NAME}»` : "";
  const firstStep =
    payment.qr && payment.phone
      ? `Переведите по номеру телефона в приложении ${PAYMENT_BANK_NAME} или отсканируйте QR-код ниже.`
      : payment.phone
        ? `Откройте приложение ${PAYMENT_BANK_NAME}${openBank} и выберите перевод по номеру телефона, указанному ниже.`
        : `Отсканируйте QR-код${openBank} — откроется ${PAYMENT_BANK_NAME}.`;
  const paidActivities = registration.activities.filter(
    (activity) => activity.pricing_type_snapshot === "fixed" && (activity.fixed_price_kopecks_snapshot ?? 0) > 0,
  );
  const heading = paymentHeading(registration.event_price_kopecks, paidActivities.length > 0);

  return (
    <div className="public-site-shell">
    <PublicSiteHeader />
    <main className="payment-page">
      <header className="payment-header">
        <Link className="back-link" href={`/event/${event.slug}`}>
          <span aria-hidden="true">←</span> К мероприятию
        </Link>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="payment-logo" src={BRAND_LOGO.src} alt={BRAND_LOGO.alt} />
      </header>

      {total > 0 ? (
        <section className="payment-card" aria-labelledby="payment-title">
          <p className="payment-event">
            «{event.title}» · {formatEventDate(event.event_date)}
          </p>
          <h1 id="payment-title">{heading}</h1>

          <dl className="payment-facts">
            <div className="payment-amount">
              <dt>К оплате</dt>
              <dd data-testid="payment-amount">{formatRub(total)}</dd>
            </div>
            <div className="payment-payer">
              <dt>Плательщик</dt>
              <dd data-testid="payment-payer">{registration.full_name}</dd>
            </div>
          </dl>

          {payment.qr || payment.phone ? (
            <ol className="payment-steps">
              <li>{firstStep}</li>
              <li>
                Введите сумму <strong>{formatRub(total)}</strong>.
              </li>
              <li>
                В сообщении к платежу укажите ФИО, как в анкете: <strong>{registration.full_name}</strong>
              </li>
            </ol>
          ) : (
            <p className="payment-missing" role="status">
              Способ оплаты ещё не настроен. Свяжитесь с организаторами — они подскажут, как оплатить.
            </p>
          )}

          {payment.phone && (
            <div className="payment-phone" data-testid="payment-phone-block">
              <p className="payment-method-label">Перевод по номеру телефона</p>
              <p className="payment-phone-number" data-testid="payment-phone">
                {payment.phone}
              </p>
              {payment.recipient && <p className="payment-recipient">Получатель: {payment.recipient}</p>}
              <CopyPhoneButton phone={payment.phone} />
            </div>
          )}

          {payment.phone && payment.qr && (
            <p className="payment-or" aria-hidden="true">
              или
            </p>
          )}

          {payment.qr && (
            <figure className="payment-qr">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={payment.qr.src} alt={payment.qr.alt} width={280} height={280} />
              <figcaption>QR оплаты · {PAYMENT_BANK_NAME}</figcaption>
            </figure>
          )}
          {payment.url && (payment.qr || payment.phone) && (
            <a className="button-primary payment-open" href={payment.url} target="_blank" rel="noopener noreferrer">
              Открыть {PAYMENT_BANK_NAME}
            </a>
          )}

          <details className="payment-items">
            <summary>Из чего складывается сумма</summary>
            <ul>
              {registration.event_price_kopecks > 0 && (
                <li>
                  <span>Участие в мероприятии</span>
                  <span>{formatRub(registration.event_price_kopecks)}</span>
                </li>
              )}
              {paidActivities.map((activity, index) => (
                <li key={`${index}-${activity.activity_title_snapshot}`}>
                  <span>{activity.activity_title_snapshot}</span>
                  <span>{formatRub(activity.fixed_price_kopecks_snapshot ?? 0)}</span>
                </li>
              ))}
            </ul>
          </details>

          <p className="payment-disclaimer">Оплата проходит в приложении банка. Сохраните эту страницу, чтобы вернуться к ней позже.</p>
        </section>
      ) : (
        <section className="payment-card payment-empty" aria-labelledby="payment-title">
          <p className="payment-event">
            «{event.title}» · {formatEventDate(event.event_date)}
          </p>
          <h1 id="payment-title">Оплата не требуется</h1>
          <p>
            В регистрации {registration.full_name} нет услуг с фиксированной стоимостью. Если вы выбрали услуги с ценой по
            согласованию, администратор свяжется с вами.
          </p>
          <Link className="button-primary" href={`/event/${event.slug}`}>
            К мероприятию
          </Link>
        </section>
      )}
    </main>
    </div>
  );
}
