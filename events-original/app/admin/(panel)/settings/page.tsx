import { SettingsForm } from "@/components/admin/SettingsForm";
import { TelegramRetry, TelegramTest } from "@/components/admin/TelegramTest";
import { mediaUrl } from "@/lib/media";
import { requireAdmin } from "@/lib/server/admin-auth";
import { getDb } from "@/lib/server/db";
import { getSettings } from "@/lib/server/repo/settings";
import { readTelegramConfig } from "@/lib/server/telegram.mjs";
import { outboxStats } from "@/lib/server/telegram-outbox.mjs";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requireAdmin();
  const db = getDb();
  const settings = getSettings(db);
  const outbox = outboxStats(db);
  const { saved } = await searchParams;
  // Только факт настройки: токен и chat_id на страницу не передаются.
  const telegramConfigured = readTelegramConfig() !== null;

  return (
    <div className="a-page a-page-narrow">
      <h1>Общие настройки</h1>
      <p className="a-hint">Эти данные одинаковы для всех мероприятий.</p>
      {saved && (
        <p className="a-message is-ok" role="status">
          Настройки сохранены.
        </p>
      )}
      <section className="a-form-section" aria-labelledby="settings-telegram">
        <h2 id="settings-telegram">Уведомления о регистрациях</h2>
        <p className={`a-status ${telegramConfigured ? "is-on" : "is-off"}`} data-testid="telegram-status">
          {telegramConfigured ? "Telegram настроен" : "Telegram не настроен"}
        </p>
        {telegramConfigured ? (
          <p className="a-hint">После каждой регистрации администрации приходит сообщение с данными участника и выбранными услугами.</p>
        ) : (
          <p className="a-hint">Задайте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в переменных окружения.</p>
        )}
        <dl className="a-outbox" data-testid="telegram-outbox">
          <div>
            <dt>Ожидают отправки</dt>
            <dd data-testid="outbox-pending">{outbox.pending}</dd>
          </div>
          <div>
            <dt>Не удалось после попыток</dt>
            <dd data-testid="outbox-failed">{outbox.failed}</dd>
          </div>
        </dl>
        {telegramConfigured && (
          <div className="a-telegram-actions">
            {/* Кнопка видна всегда: после повтора счётчики обновляются, а результат остаётся на экране. */}
            <TelegramRetry />
            <TelegramTest />
          </div>
        )}
      </section>

      <SettingsForm
        key={settings.updated_at}
        initial={{
          paymentMethod: settings.payment_method,
          paymentPhone: settings.payment_phone ?? "",
          paymentRecipient: settings.payment_recipient ?? "",
          paymentQrSrc: mediaUrl(settings.payment_qr_image),
          paymentTargetUrl: settings.payment_target_url ?? "",
          communityQrSrc: mediaUrl(settings.community_qr_image),
          communityTargetUrl: settings.community_target_url ?? "",
          communityVkUrl: settings.community_vk_url ?? "",
          communityMaxUrl: settings.community_max_url ?? "",
          communityTitle: settings.community_title,
          communityDescription: settings.community_description,
        }}
      />
    </div>
  );
}
