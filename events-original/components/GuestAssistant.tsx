"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import styles from "./GuestAssistant.module.css";
import { useAssistantChat } from "./useAssistantChat";

type Conversation = { open: boolean; size: number; draft: string };
const initial: Conversation = { open: true, size: 1, draft: "" };
const storageKey = "rublevka.guest-assistant.v2";

function restore(): Conversation {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    if (value && typeof value.open === "boolean" && [0, 1, 2].includes(value.size)) return { ...initial, open: value.open, size: value.size };
  } catch { /* Storage can be unavailable in private browsing. */ }
  return initial;
}

export function GuestAssistant({ connected = true }: { connected?: boolean }) {
  const [chat, setChat] = useState<Conversation | null>(null);
  const transport = useAssistantChat(connected && (chat?.open ?? false));
  const messages = transport.dialog?.messages;
  const lastMessageId = messages?.at(-1)?.id;
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
    if (history.current && lastMessageId) history.current.scrollTop = history.current.scrollHeight;
  }, [lastMessageId, chat?.open]);

  function update(patch: Partial<Conversation>) {
    const next = { ...current.current, ...patch };
    current.current = next;
    setChat(next);
    try { sessionStorage.setItem(storageKey, JSON.stringify({ open: next.open, size: next.size })); }
    catch { /* Keep the active conversation usable in memory. */ }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = current.current.draft.trim();
    if (message && await transport.send(message) && current.current.draft.trim() === message) update({ draft: "" });
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
            <div className={styles.message}>{transport.session?.greeting ? <p>{transport.session.greeting}</p> : <>
              <p>Добро пожаловать в волшебный мир «Рублевки»!</p>
              <p>Здесь у каждого гостя своя сказка. Одни приезжают, чтобы забыть о городской суете, насладиться тишиной вековых дубов и теплом уютного сруба. Другие — чтобы окунуться в вихрь ярких событий, веселья и незабываемых приключений!</p>
              <p><strong>Какой будет ваша сказка — тихой и уютной или яркой и головокружительной?</strong></p>
              <p>Перевернём первую страницу вместе! Я помогу подобрать отдых, домик или мероприятие именно для вас.</p></>}
            </div>
            {messages?.map((message) => (
              <div className={message.source === "guest" ? styles.reply : styles.answer} key={message.id}>
                {message.source === "staff" && <strong>Администратор</strong>}
                {message.text && <p>{message.text}</p>}
                {message.status === "failed" && <small>Ответ не получен.</small>}
                {message.cards.map((card, index) => (
                  <a className={styles.card} href={card.url} key={index}>
                    {card.photo && <Image unoptimized src={card.photo} width={96} height={64} alt="" />}
                    {card.title}
                  </a>
                ))}
              </div>
            ))}
          </div>
          <form onSubmit={submit} className={styles.form}>
            <small role="status">
              {transport.error || (transport.session?.available
                ? transport.dialog?.closed ? "Диалог завершён."
                  : transport.pending || transport.busy ? "Обрабатываем сообщение…"
                    : transport.dialog?.owner === "staff" ? "В диалоге администратор." : ""
                : transport.session?.unavailable || (connected ? "Подключаем чат…" : "Ассистент пока недоступен."))}
              {transport.session && !transport.session.available && <> <a href={transport.session.contact.url}>Связаться с администратором</a></>}
            </small>
            <input aria-label="Ваше сообщение" placeholder="Ваше сообщение…" maxLength={2000} value={chat.draft} disabled={!transport.session?.available || transport.dialog?.closed} onChange={(event) => update({ draft: event.target.value })} />
            <button type="submit" aria-label="Отправить сообщение" disabled={!chat.draft.trim() || transport.dialog?.closed || transport.pending || transport.busy || !transport.session?.available}>↑</button>
            {transport.session?.available && <button type="button" className={styles.reset} disabled={transport.busy}
              onClick={() => { void transport.reset().then((reset) => { if (reset) update({ draft: "" }); }); }}>Новый диалог</button>}
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
