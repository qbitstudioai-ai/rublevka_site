import type Database from "better-sqlite3";
import type { SettingsInput } from "../validation";

export type SettingsRow = {
  payment_method: "qr" | "phone" | "both";
  payment_phone: string | null;
  payment_recipient: string | null;
  payment_qr_image: string | null;
  payment_target_url: string | null;
  /** QR Telegram-сообщества — показывается рядом с кнопками платформ. */
  community_qr_image: string | null;
  /** Ссылка на сообщество в Telegram. */
  community_target_url: string | null;
  community_vk_url: string | null;
  community_max_url: string | null;
  community_title: string;
  community_description: string;
  updated_at: string;
};

export function getSettings(db: Database.Database): SettingsRow {
  return db.prepare("SELECT * FROM app_settings WHERE id = 1").get() as SettingsRow;
}

/**
 * Обновляет общие настройки. `undefined` для QR — оставить текущий файл.
 * Возвращает заменённые QR для очистки файлов после commit.
 */
export function updateSettings(
  db: Database.Database,
  input: SettingsInput,
  qr: { payment?: string; community?: string },
): { replacedRefs: string[] } {
  return db.transaction(() => {
    const current = getSettings(db);
    const payment = qr.payment ?? current.payment_qr_image;
    const community = qr.community ?? current.community_qr_image;
    db.prepare(
      `UPDATE app_settings SET payment_method = @paymentMethod, payment_phone = @paymentPhone,
         payment_recipient = @paymentRecipient, payment_qr_image = @payment, payment_target_url = @paymentTargetUrl,
         community_qr_image = @community, community_target_url = @communityTargetUrl,
         community_vk_url = @communityVkUrl, community_max_url = @communityMaxUrl,
         community_title = @communityTitle, community_description = @communityDescription,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = 1`,
    ).run({ ...input, payment, community });
    const replacedRefs = [
      current.payment_qr_image !== payment ? current.payment_qr_image : null,
      current.community_qr_image !== community ? current.community_qr_image : null,
    ].filter((ref): ref is string => !!ref);
    return { replacedRefs };
  })();
}
