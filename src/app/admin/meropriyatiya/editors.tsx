import { mediaCatalog } from "@/content/media";
import { formatInputDate, revision } from "@/server/admin/input";
import type { activities, events } from "@/server/events/schema";
import { ActionForm } from "../form";
import { saveActivity, saveEvent } from "./actions";
import { eventStates } from "./labels";
type Event = typeof events.$inferSelect;
type Activity = typeof activities.$inferSelect;
function ImageChoice({
  image,
  optional = false,
}: {
  image?: string | null;
  optional?: boolean;
}) {
  return (
    <label>
      Изображение из каталога
      <select name="imageId" defaultValue={image ?? ""} required={!optional}>
        <option value="">
          {optional ? "Без изображения" : "Выберите обложку"}
        </option>
        {Object.values(mediaCatalog).map((m) => (
          <option value={m.id} key={m.id}>
            {m.alt}
          </option>
        ))}
      </select>
    </label>
  );
}
function Terms({
  price,
  capacity,
}: {
  price?: number | null;
  capacity?: number | null;
}) {
  return (
    <div className="office-grid">
      <label>
        Цена в рублях
        <input
          name="price"
          inputMode="decimal"
          defaultValue={price == null ? "" : (price / 100).toFixed(2)}
        />
        <small>0 — бесплатно. Пустое поле — по запросу.</small>
      </label>
      <label>
        Количество мест
        <input
          name="capacity"
          type="number"
          min={1}
          defaultValue={capacity ?? ""}
        />
        <small>Пустое поле снимает ограничение.</small>
      </label>
    </div>
  );
}
function VerifyTerms({ activity = false }: { activity?: boolean }) {
  return (
    <label className="office-check">
      <input type="checkbox" name="verifiedTerms" value="yes" />
      {activity
        ? "Подтверждаю проверку цены и условий услуги для опубликованного события"
        : "Подтверждаю проверку дат, цен и условий, включая дополнительные услуги"}
    </label>
  );
}

export function EventEditor({ event }: { event?: Event }) {
  return (
    <ActionForm action={saveEvent} submit="Сохранить событие">
      <input type="hidden" name="id" value={event?.id ?? ""} />
      <input type="hidden" name="revision" value={revision(event ?? null)} />
      <label>
        Название
        <input
          name="title"
          maxLength={180}
          required
          defaultValue={event?.title}
        />
      </label>
      <label>
        Адрес страницы
        <input
          name="slug"
          maxLength={100}
          pattern="([a-z0-9]+-)*[a-z0-9]+"
          required
          defaultValue={event?.slug}
        />
        <small>Латинские буквы в нижнем регистре, цифры и дефисы.</small>
      </label>
      <div className="office-grid">
        <label>
          Начало, Волгоград
          <input
            type="datetime-local"
            name="startsAt"
            required
            defaultValue={formatInputDate(event?.startsAt)}
          />
        </label>
        <label>
          Окончание, Волгоград
          <input
            type="datetime-local"
            name="endsAt"
            required
            defaultValue={formatInputDate(event?.endsAt)}
          />
        </label>
      </div>
      <Terms price={event?.price} capacity={event?.capacity} />
      <ImageChoice image={event?.imageId} />
      {(
        [
          ["description", "Краткое описание", 1000],
          ["program", "Программа", 30000],
          ["conditions", "Условия участия", 5000],
          ["reviewNote", "Редакционные замечания до публикации", 4000],
        ] as const
      ).map(([name, label, max]) => (
        <label key={name}>
          {label}
          <textarea
            name={name}
            maxLength={max}
            rows={name === "program" ? 5 : 2}
            defaultValue={event?.[name]}
          />
        </label>
      ))}
      <label>
        Статус публикации
        <select name="status" defaultValue={event?.status ?? "draft"}>
          {Object.entries(eventStates).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="office-check">
        <input type="checkbox" name="group" defaultChecked={event?.group} />
        Обращение от взрослого организатора группы
      </label>
      <label className="office-check">
        <input type="checkbox" name="archive" defaultChecked={event?.archive} />
        Показывать в архиве после завершения
      </label>
      <VerifyTerms />
    </ActionForm>
  );
}
export function ActivityEditor({
  eventId,
  activity,
  published,
}: {
  eventId: string;
  published: boolean;
  activity?: Activity;
}) {
  return (
    <ActionForm action={saveActivity} submit="Сохранить активность">
      <input type="hidden" name="id" value={activity?.id ?? ""} />
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="revision" value={revision(activity ?? null)} />
      <label>
        Название активности
        <input
          name="title"
          required
          maxLength={180}
          defaultValue={activity?.title}
        />
      </label>
      <label>
        Краткое описание на карточке
        <textarea
          name="description"
          maxLength={3000}
          defaultValue={activity?.description}
        />
      </label>
      <label>
        Начало, Волгоград
        <input
          type="datetime-local"
          name="startsAt"
          defaultValue={formatInputDate(activity?.startsAt)}
        />
      </label>
      <label>
        Подробное описание услуги
        <textarea
          name="longDescription"
          maxLength={3000}
          rows={4}
          defaultValue={activity?.longDescription}
        />
      </label>
      <label>
        Что входит в услугу
        <textarea
          name="details"
          maxLength={2000}
          rows={4}
          defaultValue={activity?.details}
        />
        <small>
          Условия и ограничения размещайте по одному пункту на строку.
        </small>
      </label>
      <div className="office-grid">
        <label>
          Длительность
          <input
            name="durationText"
            maxLength={80}
            defaultValue={activity?.durationText}
          />
        </label>
        <label>
          Порядок показа
          <input
            name="position"
            type="number"
            min={0}
            max={99999}
            defaultValue={activity?.position ?? 0}
          />
        </label>
      </div>
      <Terms price={activity?.price} capacity={activity?.capacity} />
      <label>
        Уточнение к цене
        <input
          name="priceSuffix"
          maxLength={80}
          defaultValue={activity?.priceSuffix}
        />
        <small>Используйте для условий, которые уже согласованы.</small>
      </label>
      <ImageChoice image={activity?.imageId} optional />
      <details className="office-gallery">
        <summary>Дополнительные фотографии из каталога</summary>
        <div className="office-grid">
          {Object.values(mediaCatalog).map((image) => (
            <label className="office-check" key={image.id}>
              <input
                type="checkbox"
                name="galleryIds"
                value={image.id}
                defaultChecked={activity?.galleryIds.includes(image.id)}
              />
              {image.alt}
            </label>
          ))}
        </div>
      </details>
      <label className="office-check">
        <input
          type="checkbox"
          name="available"
          defaultChecked={activity?.available ?? true}
        />
        Доступна участникам
      </label>
      <label className="office-check">
        <input
          type="checkbox"
          name="required"
          defaultChecked={activity?.required}
        />
        Обязательна для участия
      </label>
      {published && <VerifyTerms activity />}
    </ActionForm>
  );
}
