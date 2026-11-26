"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import styles from "./GuestAssistant.module.css";

type Conversation = { open: boolean; size: number; messages: string[]; draft: string };
const initial: Conversation = { open: true, size: 1, messages: [], draft: "" };
const storageKey = "rublevka.guest-assistant.v1";

function restore(): Conversation {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    if (value && typeof value.open === "boolean" && [0, 1, 2].includes(value.size)
      && typeof value.draft === "string" && Array.isArray(value.messages)
      && value.messages.every((message: unknown) => typeof message === "string")) return value;
  } catch { /* Storage can be unavailable in private browsing. */ }
  return initial;
}

export function GuestAssistant() {
  const [chat, setChat] = useState<Conversation | null>(null);
  const history = useRef<HTMLDivElement>(null);
  const current = useRef(initial);
  const photo = useRef<HTMLDialogElement>(null);
  const [photoLoaded, setPhotoLoaded] = useState(false);
  function openPhoto() {
    setPhotoLoaded(true);
    photo.current?.showModal();
  }
  const portraitButton = (
    <button type="button" className={chat?.open ? styles.portrait : styles.launcher}
      aria-label="Открыть фотографию ассистента" aria-haspopup="dialog" onClick={openPhoto} />
  );
  useEffect(() => {
    current.current = restore();
    setChat(current.current);
  }, []);
  useEffect(() => {
    if (history.current && chat?.messages.length) history.current.scrollTop = history.current.scrollHeight;
  }, [chat?.messages.length, chat?.open]);

  function update(patch: Partial<Conversation>) {
    const next = { ...current.current, ...patch };
    current.current = next;
    setChat(next);
    try { sessionStorage.setItem(storageKey, JSON.stringify(next)); }
    catch { /* Keep the active conversation usable in memory. */ }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const message = current.current.draft.trim();
    if (message) update({ messages: [...current.current.messages, message], draft: "" });
  }
  if (!chat) return null;
  return (
    <aside className={styles.widget} data-assistant="" data-size={chat.size} aria-label="Ассистент Рублевки">
      {chat.open ? (
        <section className={styles.panel}>
          <header className={styles.header}>
            {portraitButton}
            <strong>Ассистент «Рублевки»</strong>
            <div className={styles.controls}>
              <button type="button" aria-label="Уменьшить окно" disabled={chat.size === 0} onClick={() => update({ size: chat.size - 1 })}>−</button>
              <button type="button" aria-label="Увеличить окно" disabled={chat.size === 2} onClick={() => update({ size: chat.size + 1 })}>+</button>
              <button type="button" aria-label="Свернуть диалог" onClick={() => update({ open: false })}>⌄</button>
            </div>
          </header>
          <div className={styles.history} ref={history} role="log" aria-label="История диалога">
            <div className={styles.message}>
              <p>Добро пожаловать в волшебный мир «Рублевки»!</p>
              <p>Здесь у каждого гостя своя сказка. Одни приезжают, чтобы забыть о городской суете, насладиться тишиной вековых дубов и теплом уютного сруба. Другие — чтобы окунуться в вихрь ярких событий, веселья и незабываемых приключений!</p>
              <p><strong>Какой будет ваша сказка — тихой и уютной или яркой и головокружительной?</strong></p>
              <p>Перевернём первую страницу вместе! Я помогу подобрать отдых, домик или мероприятие именно для вас.</p>
            </div>
            {chat.messages.map((message, index) => <p className={styles.reply} key={index}>{message}</p>)}
          </div>
          <form onSubmit={submit} className={styles.form}>
            <small>Переписка в этой вкладке · ИИ пока отключён</small>
            <input aria-label="Ваше сообщение" placeholder="Ваше сообщение…" value={chat.draft} onChange={(event) => update({ draft: event.target.value })} />
            <button type="submit" aria-label="Добавить сообщение" disabled={!chat.draft.trim()}>↑</button>
          </form>
        </section>
      ) : (
        <div className={styles.collapsed}>
          {portraitButton}
          <button type="button" className={styles.chatButton} aria-label="Открыть диалог с ассистентом" onClick={() => update({ open: true })}>Чат</button>
        </div>
      )}
      <dialog ref={photo} className={styles.photoDialog} aria-label="Фотография ассистента">
        <button type="button" className={styles.closePhoto} aria-label="Закрыть фотографию" onClick={() => photo.current?.close()}>×</button>
        {photoLoaded && <Image unoptimized src="/meropriyatiya/art/assistant-original.png" width={1254} height={1254} alt="Портрет ассистента «Рублевки»" />}
      </dialog>
    </aside>
  );
}
