"use client";

import { useRef, useState, useEffect } from "react";
import type { Chapter, Entry } from "@/content/home";
import { resolveMedia } from "@/content/media";
import { MediaFrame } from "../ui/media-frame";
import { BookDialog } from "./book-dialog";
import { BookPage, roman } from "./book-page";
import { useBook } from "./use-book";

export function StoryBook({ chapters }: { chapters: readonly Chapter[] }) {
  const { current, previous, book, select } = useBook(chapters);
  const [panel, setPanel] = useState<Entry | "menu" | null>(null);
  const touch = useRef<{ x: number; y: number; id: number } | null>(null);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        panel ||
        e.defaultPrevented ||
        e.repeat ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        !(e.target instanceof HTMLElement) ||
        e.target.closest("input, textarea, select, [contenteditable=true]")
      )
        return;
      const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (delta && current + delta >= 0 && current + delta < chapters.length) {
        e.preventDefault();
        select(current + delta);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [panel, current, chapters.length, select]);

  return (
    <main className="library" aria-label="Сказочная книга Рублевки" ref={book}>
      <div
        className="binding"
        data-turn={
          previous === null ? undefined : previous < current ? "next" : "back"
        }
        onTouchStart={(e) => {
          const t = e.touches[0];
          touch.current =
            !panel &&
            e.touches.length === 1 &&
            t.clientX > 24 &&
            t.clientX < innerWidth - 24
              ? { x: t.clientX, y: t.clientY, id: t.identifier }
              : null;
        }}
        onTouchCancel={() => {
          touch.current = null;
        }}
        onTouchEnd={(e) => {
          const start = touch.current;
          touch.current = null;
          const t = e.changedTouches[0];
          if (!start || start.id !== t.identifier || e.touches.length) return;
          const dx = t.clientX - start.x,
            dy = t.clientY - start.y;
          if (Math.abs(dx) > 58 && Math.abs(dx) > Math.abs(dy) * 1.6)
            select(current + (dx < 0 ? 1 : -1));
        }}
      >
        <button
          className="bookmark"
          aria-label="Оглавление"
          aria-haspopup="dialog"
          onClick={() => setPanel("menu")}
        >
          <span aria-hidden="true">☰</span>
        </button>
        {chapters.map((chapter, i) => (
          <BookPage
            key={chapter.id}
            chapter={chapter}
            index={i}
            count={chapters.length}
            active={i === current}
            departing={i === previous}
            select={select}
            showEntry={setPanel}
          />
        ))}
      </div>
      {panel && (
        <BookDialog
          title={panel === "menu" ? "Оглавление" : panel.title}
          close={() => setPanel(null)}
        >
          {panel === "menu" ? (
            <ol className="contents">
              {chapters.map((c, i) => (
                <li key={c.id}>
                  <button
                    aria-current={i === current ? "page" : undefined}
                    onClick={() => {
                      setPanel(null);
                      select(i);
                    }}
                  >
                    {roman(i + 1)} · {c.label}
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <>
              <MediaFrame
                mediaId={panel.media}
                sizes="(max-width: 600px) 80vw, 480px"
              />
              <p>{resolveMedia(panel.media).description}</p>
            </>
          )}
        </BookDialog>
      )}
    </main>
  );
}
