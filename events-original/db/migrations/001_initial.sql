-- Начальная схема приложения регистрации «Рублёвки».
-- Время хранится в UTC в формате ISO 8601; деньги — целым числом копеек.

CREATE TABLE events (
  id                INTEGER PRIMARY KEY,
  slug              TEXT    NOT NULL UNIQUE CHECK (length(slug) BETWEEN 2 AND 80),
  title             TEXT    NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  event_date        TEXT    NOT NULL CHECK (event_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  start_time        TEXT    NOT NULL CHECK (start_time GLOB '[0-2][0-9]:[0-5][0-9]'),
  short_description TEXT    NOT NULL DEFAULT '',
  location_text     TEXT,
  hero_image        TEXT,
  status            TEXT    NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX events_status_date_idx ON events (status, event_date);

CREATE TABLE activities (
  id                  INTEGER PRIMARY KEY,
  event_id            INTEGER NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  title               TEXT    NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  short_description   TEXT    NOT NULL DEFAULT '',
  long_description    TEXT    NOT NULL DEFAULT '',
  start_time          TEXT    CHECK (start_time IS NULL OR start_time GLOB '[0-2][0-9]:[0-5][0-9]'),
  duration_text       TEXT,
  pricing_type        TEXT    NOT NULL CHECK (pricing_type IN ('fixed', 'free', 'contact')),
  fixed_price_kopecks INTEGER,
  price_suffix        TEXT,
  card_image          TEXT,
  details             TEXT    NOT NULL DEFAULT '[]' CHECK (json_valid(details) AND json_type(details) = 'array'),
  sort_order          INTEGER NOT NULL DEFAULT 0,
  is_active           INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Цена согласована с типом: fixed > 0, free = 0, contact — без цены.
  CHECK (
    (pricing_type = 'fixed'   AND fixed_price_kopecks IS NOT NULL AND fixed_price_kopecks > 0) OR
    (pricing_type = 'free'    AND fixed_price_kopecks = 0) OR
    (pricing_type = 'contact' AND fixed_price_kopecks IS NULL)
  )
);

CREATE INDEX activities_event_order_idx ON activities (event_id, sort_order);

CREATE TABLE activity_images (
  id          INTEGER PRIMARY KEY,
  activity_id INTEGER NOT NULL REFERENCES activities (id) ON DELETE CASCADE,
  image_path  TEXT    NOT NULL,
  alt_text    TEXT    NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX activity_images_activity_idx ON activity_images (activity_id, sort_order);

CREATE TABLE registrations (
  id                  INTEGER PRIMARY KEY,
  public_id           TEXT    NOT NULL UNIQUE,
  event_id            INTEGER NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  full_name           TEXT    NOT NULL,
  phone               TEXT    NOT NULL,
  messenger           TEXT    NOT NULL,
  fixed_total_kopecks INTEGER NOT NULL CHECK (fixed_total_kopecks >= 0),
  created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX registrations_event_created_idx ON registrations (event_id, created_at);

-- Snapshot выбранной услуги на момент регистрации: не меняется при правке или удалении услуги.
CREATE TABLE registration_activities (
  id                           INTEGER PRIMARY KEY,
  registration_id              INTEGER NOT NULL REFERENCES registrations (id) ON DELETE CASCADE,
  activity_id                  INTEGER REFERENCES activities (id) ON DELETE SET NULL,
  activity_title_snapshot      TEXT    NOT NULL,
  pricing_type_snapshot        TEXT    NOT NULL CHECK (pricing_type_snapshot IN ('fixed', 'free', 'contact')),
  fixed_price_kopecks_snapshot INTEGER,
  price_suffix_snapshot        TEXT,
  start_time_snapshot          TEXT,
  created_at                   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX registration_activities_registration_idx ON registration_activities (registration_id);
CREATE INDEX registration_activities_activity_idx ON registration_activities (activity_id);

-- Единственная строка общих настроек (id = 1).
CREATE TABLE app_settings (
  id                    INTEGER PRIMARY KEY CHECK (id = 1),
  payment_qr_image      TEXT,
  payment_target_url    TEXT,
  community_qr_image    TEXT,
  community_target_url  TEXT,
  community_title       TEXT NOT NULL DEFAULT 'Присоединяйтесь в наше дружное сообщество',
  community_description TEXT NOT NULL DEFAULT '',
  updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO app_settings (id) VALUES (1);
