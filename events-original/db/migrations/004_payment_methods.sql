-- Способы оплаты: QR-код, перевод по номеру телефона или оба.
-- По умолчанию 'qr' — поведение существующих установок не меняется.

ALTER TABLE app_settings ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'qr'
  CHECK (payment_method IN ('qr', 'phone', 'both'));

-- Номер для перевода и имя получателя (для проверки участником перед переводом).
ALTER TABLE app_settings ADD COLUMN payment_phone TEXT;
ALTER TABLE app_settings ADD COLUMN payment_recipient TEXT;
