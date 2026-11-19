"use client";

import { useActionState } from "react";
import type { SiteRole } from "@/server/cms/access";
import { saveStaff } from "./actions";

type Staff = { id: string; login: string; role: SiteRole; active: boolean };

export function StaffForm({
  staff,
  currentId,
}: {
  staff?: Staff;
  currentId: string;
}) {
  const [state, action, pending] = useActionState(saveStaff, {});
  const ownAccount = staff?.id === currentId;

  return (
    <form action={action} className="sa-stack" aria-busy={pending}>
      {staff ? (
        <input type="hidden" name="id" value={staff.id} />
      ) : (
        <label className="sa-field">
          Логин
          <input name="login" maxLength={64} required autoComplete="off" />
        </label>
      )}
      <label className="sa-field">
        Роль
        <select
          name="role"
          defaultValue={staff?.role ?? "editor"}
          disabled={ownAccount}
        >
          <option value="editor">Редактор сайта</option>
          <option value="admin">Администратор сайта</option>
        </select>
      </label>
      {ownAccount && <input type="hidden" name="role" value={staff.role} />}
      {staff && (
        <label className="sa-check">
          <input
            type="checkbox"
            name="active"
            defaultChecked={staff.active}
            disabled={ownAccount}
          />{" "}
          Активный доступ
        </label>
      )}
      {ownAccount && <input type="hidden" name="active" value="on" />}
      <label className="sa-field">
        {staff ? "Новый пароль" : "Пароль"}
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={14}
          maxLength={72}
          required={!staff}
        />
        <small>
          {staff
            ? "Оставьте пустым, чтобы сохранить текущий пароль."
            : "Минимум 14 символов. Ограничение bcrypt — 72 байта."}
        </small>
      </label>
      {state.error && (
        <p className="sa-error" role="alert">
          {state.error}
        </p>
      )}
      {state.message && (
        <p className="sa-success" role="status">
          {state.message}
        </p>
      )}
      <button
        className="sa-button sa-button-primary"
        disabled={pending}
        type="submit"
      >
        {pending
          ? "Сохранение…"
          : staff
            ? "Сохранить доступ"
            : "Добавить сотрудника"}
      </button>
    </form>
  );
}
