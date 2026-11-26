import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../events/db";
import { administrator } from "./knowledge";
import { assistantSettings, assistantSettingsAudit } from "./schema";

export const settingsInput = z.strictObject({
  enabled: z.boolean(),
  greeting: z.string().trim().max(1800).transform((value) => value || null),
  unavailable: z.string().trim().min(1).max(300),
  phone: z.string().trim().max(24).regex(/^(?:\+?\d[\d ()-]{8,22}\d)?$/).transform((value) => value || null),
});
const defaults = { enabled: false, greeting: null, unavailable: "Ассистент пока недоступен.", phone: null };

export async function readSettings() {
  if (!process.env.DATABASE_URL) return defaults;
  const [row] = await db.select().from(assistantSettings).where(eq(assistantSettings.id, 1));
  return row ?? defaults;
}

export async function saveSettings(actorId: string, input: z.input<typeof settingsInput>) {
  const changes = settingsInput.parse(input);
  await db.transaction(async (tx) => {
    await tx.insert(assistantSettings).values({ id: 1, ...changes })
      .onConflictDoUpdate({ target: assistantSettings.id, set: changes });
    await tx.insert(assistantSettingsAudit).values({ actorId, changes });
  });
}

export async function publicSettings() {
  const settings = await readSettings();
  const contact = settings.phone ? { title: settings.phone, url: "tel:" + settings.phone.replace(/[^+\d]/g, "") }
    : await administrator();
  return { enabled: settings.enabled && process.env.ASSISTANT_CHAT_ENABLED === "true", greeting: settings.greeting, unavailable: settings.unavailable, contact };
}
