"use client";

import { startTransition, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Общий объём файлов в одном сохранении (лимит тела запроса — 30 МБ). */
export const MAX_FORM_FILES_BYTES = 28 * 1024 * 1024;

export function SubmitButton({
  children,
  pendingText,
  className = "a-button a-button-primary",
  pending: pendingProp,
}: {
  children: ReactNode;
  pendingText: string;
  className?: string;
  /** Для форм, отправляемых через onSubmit (без form action), состояние передаётся явно. */
  pending?: boolean;
}) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <button className={className} type="submit" disabled={pending} aria-busy={pending || undefined}>
      {pending ? pendingText : children}
    </button>
  );
}

export function FormMessage({ state }: { state: { ok?: boolean; message?: string } }) {
  if (!state.message) return null;
  return (
    <p className={`a-message ${state.ok ? "is-ok" : "is-error"}`} role={state.ok ? "status" : "alert"}>
      {state.message}
    </p>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p className="a-field-error" id={id}>
      {message}
    </p>
  );
}

/** Поле загрузки изображения с превью текущего и нового файла. */
export function ImageInput({
  name,
  label,
  hint,
  currentSrc,
  removable = false,
  removeName,
  error,
  accept = "image/jpeg,image/png,image/webp",
  square = false,
  previewFit = "cover",
  onSelect,
}: {
  name: string;
  label: string;
  hint?: string;
  currentSrc?: string | null;
  removable?: boolean;
  removeName?: string;
  error?: string;
  accept?: string;
  square?: boolean;
  /** Как показать превью: как на сайте — с обрезкой или целиком. */
  previewFit?: "cover" | "contain";
  /** Выбран подходящий файл (или выбор сброшен — null). */
  onSelect?: (file: File | null) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const shown = preview ?? currentSrc ?? null;
  const errorText = localError ?? error;
  return (
    <div className="a-field">
      <span className="a-label">{label}</span>
      <div className={`a-image-input${square ? " is-square" : ""}`}>
        <div className={`a-image-preview${previewFit === "contain" ? " is-contain" : ""}`}>
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" />
          ) : (
            <span>Нет изображения</span>
          )}
        </div>
        <div className="a-image-controls">
          <input
            type="file"
            name={name}
            accept={accept}
            aria-label={label}
            aria-invalid={errorText ? true : undefined}
            onChange={(event) => {
              const file = event.target.files?.[0];
              setLocalError(null);
              if (!file) {
                onSelect?.(null);
                return setPreview(null);
              }
              if (file.size > MAX_FILE_BYTES) {
                event.target.value = "";
                setPreview(null);
                onSelect?.(null);
                setLocalError("Файл больше 10 МБ. Выберите фотографию меньшего размера.");
                return;
              }
              setPreview(URL.createObjectURL(file));
              onSelect?.(file);
            }}
          />
          {hint && <p className="a-hint">{hint}</p>}
          {removable && currentSrc && removeName && (
            <label className="a-check">
              <input type="checkbox" name={removeName} /> Удалить текущее изображение
            </label>
          )}
          {errorText && <p className="a-field-error">{errorText}</p>}
        </div>
      </div>
    </div>
  );
}

/**
 * Отправка формы без автоматического сброса React: при ошибке валидации
 * введённые значения и выбранные файлы остаются на месте.
 */
export function submitWithoutReset(event: FormEvent<HTMLFormElement>, action: (formData: FormData) => void) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  startTransition(() => action(formData));
}

/** Кнопка, требующая подтверждения в системном диалоге (для обратимых, но заметных действий). */
export function ConfirmSubmit({ children, message, className = "a-button a-button-quiet" }: { children: ReactNode; message: string; className?: string }) {
  return (
    <button
      className={className}
      type="submit"
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="a-button a-button-quiet"
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Скопируйте ссылку:", url);
        }
      }}
    >
      {copied ? "Ссылка скопирована" : "Копировать ссылку"}
    </button>
  );
}
