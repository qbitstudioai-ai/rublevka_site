"use client";

import { useActionState } from "react";
import { retryNotificationsAction, sendTestNotificationAction, type ActionState } from "@/app/admin/actions";
import { FormMessage, SubmitButton } from "./FormParts";

export function TelegramTest() {
  const [state, action] = useActionState<ActionState>(sendTestNotificationAction, {});
  return (
    <form action={action} className="a-telegram-test">
      <SubmitButton className="a-button a-button-secondary" pendingText="Отправляем…">
        Отправить тестовое уведомление
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function TelegramRetry() {
  const [state, action] = useActionState<ActionState>(retryNotificationsAction, {});
  return (
    <form action={action} className="a-telegram-test">
      <SubmitButton className="a-button a-button-secondary" pendingText="Отправляем…">
        Повторить неотправленные
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
