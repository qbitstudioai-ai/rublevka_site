-- Надёжная доставка Telegram-уведомлений: запись outbox создаётся в той же транзакции,
-- что и регистрация, и обрабатывается до успешной отправки или исчерпания попыток.

CREATE TABLE telegram_notification_outbox (
  id              INTEGER PRIMARY KEY,
  registration_id INTEGER NOT NULL UNIQUE REFERENCES registrations (id) ON DELETE CASCADE,
  -- pending — ждёт отправки (в т.ч. после неудачной попытки), sent — доставлено,
  -- failed — попытки исчерпаны, повтор только вручную.
  status          TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts        INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  -- Краткая причина последней ошибки, без токена и ответа Telegram целиком.
  last_error      TEXT,
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_attempt_at TEXT,
  sent_at         TEXT,
  -- Захват записи обработчиком: пока срок не истёк, другой процесс её не отправляет.
  locked_until    TEXT
);

CREATE INDEX telegram_outbox_status_created_idx ON telegram_notification_outbox (status, created_at);
