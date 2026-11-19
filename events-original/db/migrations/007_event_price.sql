-- Платное участие в мероприятии.
--
-- events.price_kopecks — стоимость участия в целых копейках; NULL — участие бесплатное
-- (как у всех мероприятий до этой миграции). Ноль не храним: «бесплатно» — только NULL.
--
-- registrations.event_price_kopecks — snapshot стоимости участия на момент регистрации,
-- как snapshots цен услуг: изменение цены в админке не меняет уже сделанные регистрации.
-- fixed_total_kopecks по-прежнему итог к оплате: участие + услуги с фиксированной ценой.
-- Прежние регистрации получают 0 — участие тогда было бесплатным.

ALTER TABLE events ADD COLUMN price_kopecks INTEGER
  CHECK (price_kopecks IS NULL OR (typeof(price_kopecks) = 'integer' AND price_kopecks > 0));

ALTER TABLE registrations ADD COLUMN event_price_kopecks INTEGER NOT NULL DEFAULT 0
  CHECK (typeof(event_price_kopecks) = 'integer' AND event_price_kopecks >= 0);
