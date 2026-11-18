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
    </ActionForm>
  );
}
export function ActivityEditor({
  eventId,
  activity,
}: {
  eventId: string;
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
        Описание
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
      <Terms price={activity?.price} capacity={activity?.capacity} />
      <ImageChoice image={activity?.imageId} optional />
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
    </ActionForm>
  );
}
