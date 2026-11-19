"use client";

import { useActionState } from "react";
import { loginAction, type ActionState } from "@/app/admin/actions";
import { FormMessage, SubmitButton } from "./FormParts";

export function LoginForm() {
  const [state, action] = useActionState<ActionState, FormData>(loginAction, {});
  return (
    <form className="a-login-form" action={action}>
      <div className="a-field">
        <label className="a-label" htmlFor="username">
          Логин
        </label>
        <input id="username" name="username" type="text" autoComplete="username" required />
      </div>
      <div className="a-field">
        <label className="a-label" htmlFor="password">
          Пароль
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Входим…">Войти</SubmitButton>
    </form>
  );
}
