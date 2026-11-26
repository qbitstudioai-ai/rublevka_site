"use server";

import { redirect } from "next/navigation";
import { requireSiteMutation } from "@/server/cms/auth";
import { saveSettings, settingsInput } from "@/server/assistant/settings";

export async function updateAssistant(form: FormData) {
  const user = await requireSiteMutation(true);
  const input = {
    enabled: form.get("enabled") === "on",
    greeting: String(form.get("greeting") ?? ""),
    unavailable: String(form.get("unavailable") ?? ""),
    phone: String(form.get("phone") ?? ""),
  };
  if (!settingsInput.safeParse(input).success) redirect("/admin/site/assistant?invalid=1");
  await saveSettings(user.id, input);
  redirect("/admin/site/assistant?saved=1");
}
