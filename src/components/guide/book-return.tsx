"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { chapters } from "@/content/home";

const key = "rublevka:book-chapter";
export function rememberChapter(id: string) {
  try {
    sessionStorage.setItem(key, id);
  } catch {
    /* Storage may be disabled. */
  }
}
function readChapter() {
  try {
    return (
      chapters.find((c) => c.id === sessionStorage.getItem(key))?.id ??
      "chapter-2"
    );
  } catch {
    return "chapter-2";
  }
}
const subscribe = () => () => {};
export function BookReturn() {
  const id = useSyncExternalStore(subscribe, readChapter, () => "chapter-2");
  return (
    <Link href={`/#${id}`} className="back-to-book">
      ← К книге
    </Link>
  );
}
