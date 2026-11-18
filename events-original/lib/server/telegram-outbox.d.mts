import type Database from "better-sqlite3";
import type { RegistrationNotice, TelegramConfig, TelegramDeps } from "./telegram.mjs";

export const MAX_ATTEMPTS: number;
export const LOCK_SECONDS: number;
export const DEFAULT_BATCH_SIZE: number;

export type DeliveryOutcome = "sent" | "retry" | "failed" | "skipped";
export type DeliveryOptions = TelegramDeps & { now?: Date; includeFailed?: boolean };
export type ProcessSummary = { processed: number; sent: number; retry: number; failed: number; skipped: number };

export function enqueueRegistrationNotification(db: Database.Database, registrationId: number): void;
export function loadRegistrationNotice(db: Database.Database, registrationId: number): RegistrationNotice | null;
export function deliverOutboxEntry(db: Database.Database, config: TelegramConfig, outboxId: number, options?: DeliveryOptions): Promise<DeliveryOutcome>;
export function deliverRegistrationNotification(
  db: Database.Database,
  config: TelegramConfig,
  registrationId: number,
  options?: DeliveryOptions,
): Promise<DeliveryOutcome>;
export function processPendingTelegramNotifications(
  db: Database.Database,
  config: TelegramConfig,
  options?: DeliveryOptions & { limit?: number },
): Promise<ProcessSummary>;
export function outboxStats(db: Database.Database): { pending: number; sent: number; failed: number };
