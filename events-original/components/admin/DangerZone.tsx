"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/app/admin/actions";
import { FieldError, FormMessage, SubmitButton } from "./FormParts";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/** Удаление всех регистраций мероприятия: количество, предупреждение и явное подтверждение. */
export function DeleteRegistrationsForm({ count, action }: { count: number; action: Action }) {
  const [state, formAction] = useActionState(action, {});
  const [confirmed, setConfirmed] = useState(false);

  if (count === 0) {
    return (
      <div className="a-danger-card">
        <h3>Удалить все регистрации</h3>
        <p className="a-hint">{state.ok ? state.message : "Регистраций нет — удалять нечего."}</p>
      </div>
    );
  }

  return (
    <form className="a-danger-card" action={formAction}>
      <h3>Удалить все регистрации этого мероприятия</h3>
      <p>
        Регистраций к удалению: <strong>{count}</strong>. Вместе с ними удаляются выбранные участниками услуги. Мероприятие и его услуги
        останутся. Отменить удаление нельзя.
      </p>
      <input type="hidden" name="expectedCount" value={count} />
      <label className="a-check">
        <input type="checkbox" name="confirm" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        Я понимаю, что регистрации ({count}) будут удалены без возможности восстановления
      </label>
      <FormMessage state={state} />
      {confirmed ? (
        <SubmitButton className="a-button a-button-danger" pendingText="Удаляем…">
          Удалить регистрации ({count})
        </SubmitButton>
      ) : (
        <button className="a-button a-button-danger" type="button" disabled>
          Удалить регистрации ({count})
        </button>
      )}
    </form>
  );
}

/** Полное удаление мероприятия: требуется ввести название. */
export function DeleteEventForm({ title, registrationsCount, action }: { title: string; registrationsCount: number; action: Action }) {
  const [state, formAction] = useActionState(action, {});
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === title.trim();

  return (
    <form className="a-danger-card" action={formAction}>
      <h3>Удалить мероприятие навсегда</h3>
      <p>
        Будут удалены мероприятие, все его услуги и фотографии, регистрации (<strong>{registrationsCount}</strong>) и публичная ссылка. Если
        нужно только скрыть мероприятие, переведите его в архив.
      </p>
      <div className="a-field">
        <label className="a-label" htmlFor="confirmTitle">
          Для подтверждения введите название: <span className="a-quote">{title}</span>
        </label>
        <input id="confirmTitle" name="confirmTitle" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
        <FieldError id="confirmTitle-error" message={state.errors?.confirmTitle} />
      </div>
      <FormMessage state={state} />
      {matches ? (
        <SubmitButton className="a-button a-button-danger" pendingText="Удаляем…">
          Удалить мероприятие навсегда
        </SubmitButton>
      ) : (
        <button className="a-button a-button-danger" type="button" disabled>
          Удалить мероприятие навсегда
        </button>
      )}
    </form>
  );
}
