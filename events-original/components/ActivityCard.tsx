"use client";

import { activityPriceText } from "@/lib/activity-price";
import type { ActivityView } from "@/lib/types";

type Props = {
  activity: ActivityView;
  selected: boolean;
  onToggle: (id: number) => void;
  onDetails: (activity: ActivityView) => void;
};

export function ActivityCard({ activity, selected, onToggle, onDetails }: Props) {
  return (
    <article className={`activity-card${selected ? " is-selected" : ""}`}>
      <div className="activity-image-wrap">
        {activity.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="activity-image" src={activity.image.src} alt="" />
        )}
        {activity.time && <span className="activity-time">{activity.time}</span>}
      </div>
      <div className="activity-content">
        <div>
          <h3>{activity.title}</h3>
          {activity.teaser && <p>{activity.teaser}</p>}
        </div>
        <strong className="activity-price">{activityPriceText(activity)}</strong>
        <div className="activity-actions">
          <button className="details-link" type="button" onClick={() => onDetails(activity)} aria-haspopup="dialog">
            Подробнее
          </button>
          <label className="select-control">
            <input
              type="checkbox"
              name="activities"
              value={activity.id}
              checked={selected}
              onChange={() => onToggle(activity.id)}
              aria-label={`${selected ? "Добавлено" : "Добавить"}: ${activity.title}`}
            />
            <span aria-hidden="true">{selected ? "Добавлено" : "Добавить"}</span>
          </label>
        </div>
      </div>
    </article>
  );
}
