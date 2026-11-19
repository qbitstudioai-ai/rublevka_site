-- migrate:foreign_keys=off
-- 1. Мессенджер участника становится необязательным: пустое значение хранится как NULL.
-- 2. У snapshot услуги появляется явный порядок — так, как услуги шли в анкете.
-- Существующие регистрации и snapshots переносятся без потерь.

CREATE TABLE registrations_new (
  id                  INTEGER PRIMARY KEY,
  public_id           TEXT    NOT NULL UNIQUE,
  event_id            INTEGER NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  full_name           TEXT    NOT NULL,
  phone               TEXT    NOT NULL,
  messenger           TEXT    CHECK (messenger IS NULL OR length(trim(messenger)) > 0),
  fixed_total_kopecks INTEGER NOT NULL CHECK (fixed_total_kopecks >= 0),
  created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO registrations_new (id, public_id, event_id, full_name, phone, messenger, fixed_total_kopecks, created_at)
SELECT id, public_id, event_id, full_name, phone, NULLIF(trim(messenger), ''), fixed_total_kopecks, created_at
FROM registrations;

DROP TABLE registrations;
ALTER TABLE registrations_new RENAME TO registrations;
CREATE INDEX registrations_event_created_idx ON registrations (event_id, created_at);

-- Порядок snapshot: до этой миграции строки вставлялись в порядке показа услуг (sort_order),
-- поэтому возрастающий id внутри регистрации и есть исходный порядок.
ALTER TABLE registration_activities ADD COLUMN position INTEGER NOT NULL DEFAULT 0;

UPDATE registration_activities
SET position = (
  SELECT COUNT(*) FROM registration_activities AS earlier
  WHERE earlier.registration_id = registration_activities.registration_id
    AND earlier.id <= registration_activities.id
);
