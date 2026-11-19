import type { RegistrationWithActivities } from "./repo/registrations";

export type TelegramConfig = {
  token: string;
  chatId: string;
  /** Адрес Bot API. Переопределяется только в автоматических тестах (TELEGRAM_API_BASE). */
  apiBase: string;
  /** Адрес сайта (APP_URL) для ссылки на регистрацию в админке; '' — сообщение без ссылки. */
  appUrl: string;
};

export type TelegramFailureReason = "network" | "timeout" | "http" | "api";
export type TelegramFailure = { ok: false; reason: TelegramFailureReason; status?: number; description?: string };
export type TelegramSendResult = { ok: true } | TelegramFailure;

export type TelegramDeps = {
  fetch?: typeof fetch;
  /** Тайм-аут одной попытки (по умолчанию 6 с). */
  timeoutMs?: number;
  /** Попыток при сетевой ошибке или тайм-ауте (по умолчанию 3). */
  attempts?: number;
  /** Пауза между попытками (по умолчанию 700 мс). */
  retryDelayMs?: number;
  log?: (message: string) => void;
};

/** Только то, что нужно для текста без персональных данных: название и идентификаторы для ссылки. */
export type RegistrationNotice = {
  event: { id: number; title: string };
  registration: Pick<RegistrationWithActivities, "public_id">;
};

export const TEST_MESSAGE: string;
export function readTelegramConfig(env?: Record<string, string | undefined>): TelegramConfig | null;
export function redactSecret(text: string, token: string): string;
export function sendTelegramMessage(config: TelegramConfig, text: string, deps?: TelegramDeps): Promise<TelegramSendResult>;
export function formatRegistrationMessage(notice: RegistrationNotice, appUrl?: string): string;
export function describeFailure(result: TelegramFailure): string;
export function notifyNewRegistration(config: TelegramConfig, notice: RegistrationNotice, deps?: TelegramDeps): Promise<TelegramSendResult>;
export function describeTestResult(result: TelegramSendResult): string;
