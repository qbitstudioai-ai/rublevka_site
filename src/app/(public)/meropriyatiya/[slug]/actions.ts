"use server";
import { createHmac } from "node:crypto";
import { sameOrigin } from "@/server/admin/session";
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
  termsVersion: number,
  _previous: SubmitResult,
  form: FormData,
): Promise<SubmitResult> {
  if (!(await testRegistrationEnabled()) || !(await sameOrigin()))
    return { error: "Приём заявок пока закрыт." };
  if (!Number.isSafeInteger(termsVersion) || termsVersion <= 0)
    return { error: "Откройте страницу мероприятия заново." };
  try {
    const phone = String(form.get("phone") ?? "").trim();
    const digits = phone.replace(/\D/g, "");
    if (phone.length > 32 || !/^\d{10,15}$/.test(digits))
      return { error: "Проверьте номер телефона." };
    // The test-only database connection secret keys this digest across server instances.
    // Only a digest of the phone is stored in the rate-limit table.
    const guestBucket = createHmac("sha256", process.env.DATABASE_URL!)
      .update(digits)
      .digest("hex");
    if (!(await takeRateLimit("event-submit-" + guestBucket, 12, 60)))
      return { error: "Слишком много обращений. Попробуйте через минуту." };
    const receipt = await registerGuest({
      eventId,
      requestId,
      termsVersion,
      name: String(form.get("name") ?? ""),
      phone,
      groupSize: form.has("groupSize")
        ? Number(form.get("groupSize"))
        : undefined,
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
