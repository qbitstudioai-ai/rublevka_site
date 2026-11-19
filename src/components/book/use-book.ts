"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BookChapter } from "./book-page";

export function useBook(chapters: readonly BookChapter[], closePanel: () => void) {
  const [current, setCurrent] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);
  const active = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const book = useRef<HTMLElement>(null);

  const select = useCallback(
    (index: number, historyEvent = false) => {
      if (
        index < 0 ||
        index >= chapters.length ||
        (!historyEvent && timer.current)
      )
        return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      const old = active.current;
      active.current = index;
      if (!historyEvent && old !== index)
        window.history.pushState(null, "", "#" + chapters[index].id);
      setCurrent(index);
      if (
        old !== index &&
        !historyEvent &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        setPrevious(old);
        timer.current = setTimeout(() => {
          setPrevious(null);
          timer.current = null;
        }, 800);
      } else setPrevious(null);
    },
    [chapters],
  );

  useEffect(() => {
    const restore = () => {
      closePanel();
      select(
        Math.max(
          0,
          chapters.findIndex((c) => "#" + c.id === location.hash),
        ),
        true,
      );
    };
    restore();
    window.addEventListener("popstate", restore);
    window.addEventListener("hashchange", restore);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      window.removeEventListener("popstate", restore);
      window.removeEventListener("hashchange", restore);
    };
  }, [chapters, closePanel, select]);

  const lastFocused = useRef(0);
  useEffect(() => {
    if (lastFocused.current !== current) {
      book.current
        ?.querySelector<HTMLElement>("[data-active] [data-title]")
        ?.focus({ preventScroll: true });
      lastFocused.current = current;
    }
  }, [current]);
  return { current, previous, book, select };
}
