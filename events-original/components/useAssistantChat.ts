"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Card = { title: string; url: string; photo?: string };
type Message = { id: string; source: "guest" | "assistant" | "staff"; text: string;
  cards: Card[]; sending: boolean; status: "complete" | "failed" | "pending" };
type Session = { active: boolean; available: boolean; greeting: string | null; unavailable: string; contact: { title: string; url: string } };
type Dialog = { closed: boolean; owner: string; acknowledge: string[]; messages: Message[] };
const pollError = "Не удалось обновить диалог.";
const path = "/api/assistant/v1/chat/";

class RequestError extends Error {
  constructor(status: number, public code?: string) { super(String(status)); }
}

async function request<T>(command: string, input?: object, signal?: AbortSignal) {
  const response = await fetch(path + command, {
    method: input === undefined ? "GET" : "POST", signal, cache: "no-store",
    headers: { "X-Assistant-Client": "browser", ...(input && { "Content-Type": "application/json" }) },
    body: input === undefined ? undefined : JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new RequestError(response.status, body?.error);
  }
  return await response.json() as T;
}

function context() {
  const path = location.pathname;
  if (path === "/karta") {
    const mapObjectId = document.querySelector<HTMLElement>("[data-assistant-map-object]")?.dataset.assistantMapObject;
    return { path, mapObjectId };
  }
  if (path !== "/bronirovanie") return { path };
  const params = new URLSearchParams(location.search);
  function day(field: string) {
    const value = params.get(field);
    return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
  }
  function guests(field: string, minimum: number) {
    const value = params.get(field);
    const count = Number(value);
    return value && Number.isInteger(count) && count >= minimum && count <= 100 ? count : undefined;
  }
  const arrival = day("arrival");
  const departure = day("departure");
  const adults = guests("adults", 1);
  const children = guests("children", 0);
  const categoryId = params.get("room") || undefined;
  if (!arrival && !departure && adults === undefined && children === undefined && !categoryId) return { path };
  return { path, stay: { arrival, departure: arrival && departure && arrival >= departure ? undefined : departure, adults, children, categoryId } };
}

export function useAssistantChat(open: boolean) {
  const [session, setSession] = useState<Session | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const generation = useRef(0);
  const submission = useRef<{ text: string; id: string; context: ReturnType<typeof context> } | null>(null);
  const pending = dialog?.messages.some((message) => message.status === "pending") ?? false;

  const load = useCallback(async (signal?: AbortSignal) => {
    const version = generation.current;
    const state = await request<Dialog>("messages", undefined, signal);
    if (version === generation.current && !signal?.aborted) setDialog(state);
  }, []);

  useEffect(() => {
    if (!open || !dialog?.acknowledge.length) return;
    const abort = new AbortController();
    void request("ack", { ids: dialog.acknowledge }, abort.signal).catch(() => {});
    return () => abort.abort();
  }, [dialog, open]);

  useEffect(() => {
    if (!open || session) return;
    const abort = new AbortController();
    void request<Session>("session", {}, AbortSignal.any([abort.signal, AbortSignal.timeout(6000)])).then(setSession).catch(() => {
      if (!abort.signal.aborted) setError("Не удалось подключить чат.");
    });
    return () => abort.abort();
  }, [open, session]);

  useEffect(() => {
    if (!open || !session?.active) return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    async function poll() {
      if (!document.hidden && !operation.current) {
        try { await load(AbortSignal.any([abort.signal, AbortSignal.timeout(6000)])); failures = 0; setError((current) => current === pollError ? "" : current); }
        catch (error) {
          if (abort.signal.aborted) return;
          if (error instanceof Error && ["401", "404"].includes(error.message)) {
            setDialog(null);
            setSession(null);
            return;
          }
          if (++failures === 3) setError(pollError);
        }
      }
      if (!abort.signal.aborted) timer = setTimeout(poll, failures ? 9000 : 3200);
    }
    void poll();
    return () => { abort.abort(); clearTimeout(timer); };
  }, [open, session, load]);

  async function send(text: string) {
    if (operation.current || !session?.available || pending || dialog?.closed) return false;
    operation.current = true;
    generation.current++;
    setBusy(true);
    setError("");
    if (submission.current?.text !== text) submission.current = { text, id: crypto.randomUUID(), context: context() };
    let sent = false;
    let exhausted = false;
    try {
      if (!session.active) {
        const state = await request<Session>("session", { create: true }, AbortSignal.timeout(6000));
        setSession(state);
        if (!state.active) throw new Error("Session unavailable");
      }
      await request("messages", submission.current, AbortSignal.timeout(12000));
      sent = true;
    } catch (error) {
      exhausted = error instanceof RequestError && error.code === "delivery_exhausted";
      setError(exhausted ? "Не удалось доставить сообщение. Отправьте его снова." : "Не удалось подтвердить отправку.");
    }
    try {
      const latest = await request<Dialog>("messages", undefined, AbortSignal.timeout(6000));
      setDialog(latest);
      const recorded = latest.messages.find(({ id }) => id === submission.current?.id);
      const failed = recorded?.status === "failed";
      if (recorded && !failed && (!recorded.sending || sent)) { sent = true; setError(""); }
      if (failed) {
        sent = false;
        if (!exhausted) setError("Не удалось отправить сообщение.");
      }
    } catch { /* The next poll restores the current state. */ }
    if (sent || exhausted) submission.current = null;
    operation.current = false;
    setBusy(false);
    return sent;
  }

  async function reset() {
    if (operation.current) return;
    operation.current = true;
    generation.current++;
    setBusy(true);
    setError("");
    try {
      const state = await request<Session>("session", { reset: true }, AbortSignal.timeout(6000));
      submission.current = null;
      setDialog(null);
      setSession(state);
      if (state.active) await load(AbortSignal.timeout(6000));
      return true;
    } catch { setError("Не удалось начать новый диалог."); }
    finally { operation.current = false; setBusy(false); }
  }

  return { session, dialog, error, busy, pending, send, reset };
}
