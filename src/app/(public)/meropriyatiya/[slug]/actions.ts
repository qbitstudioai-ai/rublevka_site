"use server";
import { GuestError, registerGuest } from "@/server/events/registration";
import { testRegistrationEnabled } from "@/server/events/test-mode";
import { takeRateLimit } from "@/server/admin/limits";

export type SubmitResult =
  | { error: string }
  | { receipt: Awaited<ReturnType<typeof registerGuest>> }
  | null;
export async function submitRegistration(
  eventId: string,
  requestId: string,
  _previous: SubmitResult,
  form: FormData,
): Promise<SubmitResult> {
  if (!(await testRegistrationEnabled()))
    return { error: "Приём заявок пока закрыт." };
  try {
    if (!(await takeRateLimit("event-submit", 30, 60)))
      return { error: "Слишком много обращений. Попробуйте через минуту." };
    const receipt = await registerGuest({
      eventId,
      requestId,
      name: String(form.get("name") ?? ""),
      phone: String(form.get("phone") ?? ""),
      messenger: String(form.get("messenger") ?? ""),
      consent: form.get("consent") === "yes",
      activityIds: form.getAll("activity").map(String),
    });
    return { receipt };
  } catch (error) {
    return {
      error:
        error instanceof GuestError
          ? error.message
          : "Не удалось проверить сохранение заявки. Попробуйте ещё раз.",
    };
  }
}
