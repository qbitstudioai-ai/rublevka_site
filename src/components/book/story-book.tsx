"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import Link from "next/link";
import type { BookChapter } from "./book-page";
import { sections, sectionIds } from "@/content/sections";
import { rememberChapter } from "../guide/book-return";
import { BookDialog } from "./book-dialog";
import { BookCover, type BookEntryState } from "./book-cover";
import { BookPage, roman } from "./book-page";
import { useBook } from "./use-book";
import styles from "./story-book.module.css";

export function StoryBook({ chapters }: { chapters: readonly BookChapter[] }) {
  const [panel, setPanel] = useState(false);
  const [entry, setEntry] = useState<BookEntryState>("closed");
  const closePanel = useCallback(() => setPanel(false), []);
  const { current, previous, book, select } = useBook(chapters, closePanel);
  const touch = useRef<{ x: number; y: number; id: number } | null>(null);
  const bookOpen = entry === "open";

  const openBook = useCallback(() => {
    if (entry !== "closed") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setEntry("open");
      return;
    }
    setEntry("opening");
  }, [entry]);

  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        !bookOpen ||
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
  }, [bookOpen, panel, current, chapters.length, select]);

  useEffect(() => {
    if (!bookOpen) return;
    book.current
      ?.querySelector<HTMLElement>("[data-active] [data-title]")
      ?.focus({ preventScroll: true });
  }, [bookOpen, book]);

  useEffect(() => {
    if (entry !== "opening") return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finish = () => setEntry("open");
    const finishIfReduced = () => {
      if (motion.matches) finish();
    };
    const fallback = window.setTimeout(finish, 1600);
    motion.addEventListener("change", finishIfReduced);
    return () => {
      window.clearTimeout(fallback);
      motion.removeEventListener("change", finishIfReduced);
    };
  }, [entry]);

  return (
    <main
      className={`library ${styles.entry}`}
      aria-label="Сказочная книга Рублевки"
      data-entry={entry}
      ref={book}
    >
      <div
        className="binding"
        aria-hidden={!bookOpen}
        inert={!bookOpen}
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
          disabled={previous !== null}
          onClick={() => setPanel(true)}
        >
          <span>Оглавление</span>
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
          />
        ))}
      </div>
      <BookCover
        entry={entry}
        open={openBook}
        opened={() => setEntry("open")}
      />
      {panel && (
        <BookDialog contents title="Оглавление" close={closePanel}>
          <ol className="contents">
            {chapters.map((c, i) => (
              <li key={c.id}>
                <button
                  aria-current={i === current ? "page" : undefined}
                  onClick={() => {
                    setPanel(false);
                    select(i);
                  }}
                >
                  <span className="contents-number">{roman(i + 1)}</span>
                  {c.label}
                </button>
              </li>
            ))}
          </ol>
          <nav className="book-sections" aria-label="Разделы комплекса">
            <Link
              href="/bronirovanie"
              onClick={() => rememberChapter(chapters[current].id)}
            >
              Выбрать даты
            </Link>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- The mounted events app owns its own router. */}
            <a
              href="/meropriyatiya"
              onClick={() => rememberChapter(chapters[current].id)}
            >
              Мероприятия
            </a>
            <Link href="/karta" prefetch={false} onClick={() => rememberChapter(chapters[current].id)}>
              Карта комплекса
            </Link>
            {sectionIds.map((id) => (
              <Link
                key={id}
                href={"/" + id}
                onClick={() => rememberChapter(chapters[current].id)}
              >
                {sections[id]}
              </Link>
            ))}
          </nav>
        </BookDialog>
      )}
    </main>
  );
}
