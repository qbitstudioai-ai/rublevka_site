"use client";

import { useEffect, useRef } from "react";
import { activityPriceText } from "@/lib/activity-price";
import type { ActivityView } from "@/lib/types";

type Props = {
  activity: ActivityView | null;
  selected: boolean;
  /** После регистрации выбор услуг закрыт — окно остаётся только для просмотра. */
  locked?: boolean;
  onClose: () => void;
  onToggle: (id: number) => void;
};

export function ActivityDetails({ activity, selected, locked = false, onClose, onToggle }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (activity && !dialog.open) dialog.showModal();
    if (!activity && dialog.open) dialog.close();
  }, [activity]);

  if (!activity) return <dialog ref={dialogRef} aria-label="Подробности активности" />;

  // Если галерея не заполнена, показываем фото карточки.
  const gallery = activity.gallery.length ? activity.gallery : activity.image ? [activity.image] : [];

  return (
    <dialog
      ref={dialogRef}
      className="details-dialog"
      aria-labelledby="details-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className={`details-panel${gallery.length ? "" : " no-gallery"}`}>
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Закрыть подробности">
          <span aria-hidden="true">×</span>
        </button>
        {gallery.length > 0 && (
          <div className={`details-gallery${gallery.length === 1 ? " is-single" : ""}`} aria-label="Фотографии активности">
            {gallery.map((image, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={`${image.src}-${index}`} src={image.src} alt={image.alt} />
            ))}
          </div>
        )}
        <div className="details-copy">
          <p className="eyebrow">Подробности</p>
          <h2 id="details-title">{activity.title}</h2>
          {activity.description && <p>{activity.description}</p>}
          {activity.details.length > 0 && (
            <ul>
              {activity.details.map((item, index) => (
                <li key={`${index}-${item}`}>{item}</li>
              ))}
            </ul>
          )}
          {activity.time && <p className="details-meta">Начало — {activity.time}</p>}
          {activity.duration && <p className="details-meta">Длительность — {activity.duration}</p>}
          <div className="details-action">
            <strong>{activityPriceText(activity)}</strong>
            {!locked && (
              <button className={selected ? "button-secondary" : "button-primary"} type="button" onClick={() => onToggle(activity.id)}>
                {selected ? "Убрать из регистрации" : "Добавить к регистрации"}
              </button>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}
