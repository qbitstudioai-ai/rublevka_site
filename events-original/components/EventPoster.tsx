"use client";

import { useEffect, useRef, useState } from "react";
import type { ImageAsset } from "@/lib/types";

type Props = {
  image: ImageAsset;
  title: string;
  day: string;
  month: string;
  caption: string | null;
  /** Мероприятие прошло — в окне просмотра нет возврата к регистрации. */
  closed?: boolean;
};

/**
 * Афиша в шапке анкеты (режим «Афиша»): целиком, без обрезки, в белой рамке на персиковой подложке,
 * с листком даты. Высота рамки задана, ширина следует пропорциям файла (9 : 16, 4 : 5, 3 : 4).
 * Мелкий текст афиши в уменьшенном виде не прочитать — кнопка открывает её на весь экран.
 */
export function EventPoster({ image, title, day, month, caption, closed = false }: Props) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <div className="hero-poster" data-testid="hero-poster">
      <div className="poster-sheet">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="poster-image" src={image.src} alt={image.alt} />
        <span className="event-leaf poster-leaf" aria-hidden="true">
          <span className="event-leaf-day">{day}</span>
          <span className="event-leaf-month">{month}</span>
        </span>
        <button className="poster-open" type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M15.5 15.5 21 21M10.5 7.5v6M7.5 10.5h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Открыть афишу
        </button>
      </div>
      {/* Подпись места — у края подложки: на компьютере вертикально, на телефоне под кнопкой. */}
      {caption && <p className="poster-caption">{caption}</p>}

      <dialog
        ref={dialogRef}
        className="poster-dialog"
        aria-label={`Афиша «${title}»`}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpen(false);
        }}
      >
        <div className="poster-dialog-head">
          <p>Афиша · {title}</p>
          <button className="poster-dialog-close" type="button" onClick={() => setOpen(false)} aria-label="Закрыть афишу">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="poster-dialog-image" src={image.src} alt={image.alt} />
        {/* Подсказка только для сенсорных экранов: на компьютере афиша и так крупная. */}
        <p className="poster-dialog-hint">Чтобы рассмотреть детали, увеличьте двумя пальцами</p>
        <button className="button-secondary poster-dialog-back" type="button" onClick={() => setOpen(false)}>
          {closed ? "Закрыть афишу" : "Вернуться к регистрации"}
        </button>
      </dialog>
    </div>
  );
}
