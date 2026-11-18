-- Окончание мероприятия и режим показа главной фотографии.
--
-- end_date / end_time — необязательные. end_date заполняется только для многодневных
-- мероприятий (если окончание в тот же день, хранится NULL). Порядок «окончание позже начала»
-- проверяет приложение: SQLite не умеет добавлять табличные CHECK через ALTER TABLE.
--
-- hero_fit: 'cover' — фото заполняет рамку (края обрезаются, как раньше);
--           'contain' — фото целиком (афиши, вертикальные фото), поля закрываются размытой копией.

ALTER TABLE events ADD COLUMN end_date TEXT
  CHECK (end_date IS NULL OR end_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]');

ALTER TABLE events ADD COLUMN end_time TEXT
  CHECK (end_time IS NULL OR end_time GLOB '[0-2][0-9]:[0-5][0-9]');

ALTER TABLE events ADD COLUMN hero_fit TEXT NOT NULL DEFAULT 'cover'
  CHECK (hero_fit IN ('cover', 'contain'));
