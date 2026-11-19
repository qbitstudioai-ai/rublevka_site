"use client";

import { useActionState } from "react";
import { signInSite } from "../session-actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(signInSite, {});
  return (
    <form action={action} aria-busy={pending} className="sa-stack">
      <label className="sa-field">
        Логин
        <input name="login" autoComplete="username" maxLength={64} required />
      </label>
      <label className="sa-field">
        Пароль
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={72}
          required
        />
      </label>
      {state.error && (
        <p className="sa-error" role="alert">
          {state.error}
        </p>
      )}
      <button
        className="sa-button sa-button-primary"
        type="submit"
        disabled={pending}
      >
        {pending ? "Входим…" : "Войти"}
      </button>
    </form>
  );
}
