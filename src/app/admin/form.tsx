"use client";
import { startTransition, useActionState } from "react";
export type FormState = { message: string; ok?: boolean };
type Props = {
  action: (previous: FormState, form: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submit: string;
};
export function ActionForm({ action, children, submit }: Props) {
  const [state, dispatch, pending] = useActionState(action, { message: "" });
  return (
    <form
      action={dispatch}
      className="office-form"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => dispatch(data));
      }}
    >
      {children}
      <div className="office-submit">
        <button disabled={pending}>{pending ? "Сохранение…" : submit}</button>
        <p role="status">{state.message}</p>
      </div>
    </form>
  );
}
