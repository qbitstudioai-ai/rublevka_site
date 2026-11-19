-- Подробное описание мероприятия: открывается свитком «Подробнее» в шапке страницы регистрации.
-- Длина не ограничена. Пустая строка — свитка нет.

ALTER TABLE events ADD COLUMN long_description TEXT NOT NULL DEFAULT '';
