"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  title: string;
  text: string;
};

/**
 * Balkara — «уникейс»: строчные буквы нарисованы теми же заглавными формами и той же высоты.
 * Чтобы в тексте свитка различались заглавные и строчные, заглавные набираются крупнее (как капитель).
 */
function withCapitals(text: string) {
  return text.split(/(\p{Lu}+)/u).map((part, index) =>
    index % 2 === 1 ? (
      <span key={index} className="scroll-cap">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

/**
 * Свиток «Подробнее» в шапке анкеты. Свёрнутый пергамент — кнопка; по нажатию пергамент
 * разворачивается во всю длину подробного описания: полотно повторяется по вертикали,
 * поэтому свиток подстраивается под любой объём текста. Картинки — public/parchment
 * (scripts/generate-parchment.mjs).
 */
export function EventDetailsScroll({ title, text }: Props) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Нижний валик «съезжает» вниз на высоту полотна — свиток разворачивается сверху вниз.
      const height = sheetRef.current?.offsetHeight ?? 0;
      dialog.style.setProperty("--sheet-height", `${height}px`);
      dialog.scrollTop = 0;
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      {/* Имя для экранного диктора уточнено: «Подробнее» есть и у карточек услуг. */}
      <button
        className="scroll-closed"
        type="button"
        aria-haspopup="dialog"
        aria-label="Подробнее о мероприятии"
        onClick={() => setOpen(true)}
        data-testid="details-scroll"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/meropriyatiya/parchment/rolled.webp" alt="" width={900} height={250} />
        <span className="scroll-closed-label">Подробнее</span>
      </button>

      <dialog
        ref={dialogRef}
        className="scroll-dialog"
        aria-labelledby="scroll-title"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpen(false);
        }}
      >
        <div className="scroll-open">
          {/* Крестик первым в разметке: при открытии фокус встаёт на него, и свиток не прокручивается к концу. */}
          <button className="scroll-close" type="button" onClick={() => setOpen(false)} aria-label="Свернуть свиток">
            <span aria-hidden="true">×</span>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="scroll-roll is-top" src="/meropriyatiya/parchment/roll.webp" alt="" width={1300} height={170} loading="lazy" />
          <div className="scroll-sheet" ref={sheetRef}>
            <p className="scroll-kicker">Подробнее о мероприятии</p>
            <h2 className="scroll-title" id="scroll-title">
              «{title}»
            </h2>
            <div className="scroll-text">{withCapitals(text)}</div>
            <button className="scroll-fold" type="button" onClick={() => setOpen(false)}>
              Свернуть свиток
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="scroll-roll is-bottom" src="/meropriyatiya/parchment/roll.webp" alt="" width={1300} height={170} loading="lazy" />
        </div>
      </dialog>
    </>
  );
}
