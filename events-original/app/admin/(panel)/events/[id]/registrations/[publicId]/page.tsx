import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import { formatRub, priceText } from "@/lib/money";
import { requireAdmin } from "@/lib/server/admin-auth";
import { getDb } from "@/lib/server/db";
import { getEventById } from "@/lib/server/repo/events";
import { getRegistrationByPublicId } from "@/lib/server/repo/registrations";
import { idSchema, publicIdSchema } from "@/lib/server/validation";

const PRICING_LABELS = { fixed: "Фиксированная", free: "Бесплатно", contact: "По согласованию" } as const;

export default async function RegistrationDetailsPage({ params }: { params: Promise<{ id: string; publicId: string }> }) {
  await requireAdmin();
  const raw = await params;
  const eventId = idSchema.safeParse(raw.id);
  const publicId = publicIdSchema.safeParse(raw.publicId);
  if (!eventId.success || !publicId.success) notFound();

  const db = getDb();
  const event = getEventById(db, eventId.data);
  const registration = getRegistrationByPublicId(db, publicId.data);
  if (!event || !registration || registration.event_id !== event.id) notFound();

  return (
    <div className="a-page a-page-narrow">
      <Link className="a-back" href={`/admin/events/${event.id}#registrations`}>
        ← Регистрации «{event.title}»
      </Link>
      <h1>{registration.full_name}</h1>
      <dl className="a-details">
        <div>
          <dt>Зарегистрирован</dt>
          <dd>{formatDateTime(registration.created_at)}</dd>
        </div>
        <div>
          <dt>Телефон</dt>
          <dd>
            <a className="a-link" href={`tel:${registration.phone.replace(/[^\d+]/g, "")}`}>
              {registration.phone}
            </a>
          </dd>
        </div>
        <div>
          <dt>Мессенджер</dt>
          <dd className={registration.messenger ? undefined : "a-muted"}>{registration.messenger ?? "Не указан"}</dd>
        </div>
        {registration.event_price_kopecks > 0 && (
          <div>
            <dt>Участие в мероприятии</dt>
            <dd data-testid="registration-event-price">{formatRub(registration.event_price_kopecks)}</dd>
          </div>
        )}
        <div>
          <dt>Фиксированная сумма</dt>
          <dd data-testid="registration-total">{formatRub(registration.fixed_total_kopecks)}</dd>
        </div>
        <div>
          <dt>Страница оплаты</dt>
          <dd>
            {registration.fixed_total_kopecks > 0 ? (
              <a className="a-link" href={`/meropriyatiya/payment/${registration.public_id}`} target="_blank" rel="noopener noreferrer">
                Открыть страницу оплаты участника
              </a>
            ) : (
              "Оплата не требуется"
            )}
          </dd>
        </div>
      </dl>

      <h2 className="a-subtitle">Выбранные услуги на момент регистрации</h2>
      {registration.activities.length === 0 ? (
        <p className="a-empty">Без дополнительных услуг.</p>
      ) : (
        <table className="a-table a-table-compact">
          <thead>
            <tr>
              <th scope="col">Услуга</th>
              <th scope="col">Тип цены</th>
              <th scope="col" className="is-number">
                Цена
              </th>
            </tr>
          </thead>
          <tbody>
            {registration.activities.map((activity, index) => (
              <tr key={index} data-testid="snapshot-row">
                <td data-label="Услуга">
                  {activity.activity_title_snapshot}
                  {activity.activity_id === null && <span className="a-hint"> (услуга удалена)</span>}
                </td>
                <td data-label="Тип цены">{PRICING_LABELS[activity.pricing_type_snapshot]}</td>
                <td data-label="Цена" className="is-number">
                  {priceText(activity.pricing_type_snapshot, activity.fixed_price_kopecks_snapshot, activity.price_suffix_snapshot)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="a-hint">Название и цена зафиксированы при регистрации и не меняются, если услугу позже отредактировать или удалить.</p>
    </div>
  );
}
