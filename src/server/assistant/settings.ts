import { and, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../events/db";
import { administrator } from "./knowledge";
import { assistantConsultations, assistantDialogs, assistantMessages, assistantSettings, assistantSettingsAudit } from "./schema";

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
    if (!changes.enabled) {
      const active = tx.select({ id: assistantDialogs.id }).from(assistantDialogs)
        .where(and(eq(assistantDialogs.closed, false), gt(assistantDialogs.expiresAt, new Date())));
      await tx.update(assistantDialogs).set({ version: sql`${assistantDialogs.version} + 1` })
        .where(and(eq(assistantDialogs.closed, false), gt(assistantDialogs.expiresAt, new Date())));
      await tx.update(assistantConsultations).set({ status: "cancelled", result: null })
        .where(and(inArray(assistantConsultations.dialogId, active), inArray(assistantConsultations.status, ["requested", "answered"])));
      await tx.update(assistantMessages).set({ status: "cancelled" })
        .where(and(inArray(assistantMessages.dialogId, active), ne(assistantMessages.source, "guest"), isNull(assistantMessages.deliveredAt)));
      await tx.update(assistantMessages).set({ status: "complete", webhook: null, dispatchLease: null })
        .where(and(inArray(assistantMessages.dialogId, active), eq(assistantMessages.source, "guest"),
          or(inArray(assistantMessages.status, ["pending", "sending"]), sql`${assistantMessages.webhook} is not null`)));
    }
    await tx.insert(assistantSettingsAudit).values({ actorId, changes });
  });
}

export async function publicSettings() {
  const settings = await readSettings();
  const contact = settings.phone ? { title: settings.phone, url: "tel:" + settings.phone.replace(/[^+\d]/g, "") }
    : await administrator();
  return { enabled: settings.enabled && process.env.ASSISTANT_CHAT_ENABLED === "true", greeting: settings.greeting, unavailable: settings.unavailable, contact };
}
