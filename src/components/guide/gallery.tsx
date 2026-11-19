"use client";
import { useRef, useState } from "react";
import type { MediaAsset } from "@/content/media";
import { MediaFrame } from "../ui/media-frame";

export function PhotoGallery({ photos }: { photos: readonly MediaAsset[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const move = (step: number) =>
    setIndex((i) => (i + step + photos.length) % photos.length);
  return (
    <>
      <ul className="photo-grid">
        {photos.map((photo, i) => {
          return (
            <li key={photo.id}>
              <a
                href={photo.src}
                aria-haspopup="dialog"
                onClick={(e) => {
                  if (
                    e.metaKey ||
                    e.ctrlKey ||
                    e.altKey ||
                    e.shiftKey ||
                    !dialog.current
                  )
                    return;
                  e.preventDefault();
                  setIndex(i);
                  dialog.current.showModal();
                }}
              >
                <MediaFrame
                  asset={photo}
                  sizes="(max-width: 700px) 92vw, 32vw"
                />
                <span>
                  {photo.alt}
                  <b aria-hidden="true">↗</b>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      <dialog
        className="photo-viewer"
        ref={dialog}
        aria-label="Просмотр фотографий"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            move(e.key === "ArrowRight" ? 1 : -1);
          }
        }}
      >
        <button
          className="viewer-close"
          onClick={() => dialog.current?.close()}
        >
          Закрыть ×
        </button>
        <MediaFrame asset={photos[index]} sizes="90vw" />
        <div className="viewer-tools">
          <button onClick={() => move(-1)} aria-label="Предыдущее фото">
            ←
          </button>
          <p aria-live="polite">
            {index + 1} / {photos.length} · {photos[index].alt}
          </p>
          <button onClick={() => move(1)} aria-label="Следующее фото">
            →
          </button>
        </div>
      </dialog>
    </>
  );
}
