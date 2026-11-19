# База данных

SQLite через `better-sqlite3`. Файл задаётся `DATABASE_PATH` (по умолчанию `data/rublevka.sqlite`, в Git не попадает).

При каждом подключении: `journal_mode = WAL`, `foreign_keys = ON`, `busy_timeout = 5000`, `synchronous = NORMAL`.

Время — UTC в ISO 8601. Деньги — целые копейки (`INTEGER`), float не используется.

## Таблицы

### events — мероприятия

| Поле | Тип | Примечание |
|---|---|---|
| id | INTEGER PK | |
| slug | TEXT UNIQUE | часть ссылки `/event/[slug]`; при смене названия не меняется |
| title | TEXT | |
| event_date | TEXT | `YYYY-MM-DD` |
| start_time | TEXT | `HH:MM` |
| end_date | TEXT NULL | `YYYY-MM-DD`, только у многодневных (миграция `006`); окончание в тот же день — NULL |
| end_time | TEXT NULL | `HH:MM`, необязательно (миграция `006`). Порядок «окончание позже начала» проверяет приложение |
| short_description | TEXT | |
| location_text | TEXT NULL | подпись на hero-фото |
| hero_image | TEXT NULL | ссылка на изображение |
| extra_info | TEXT | текст блока «Дополнительно» рядом с анкетой (миграция `008`); `''` — блока нет |
| long_description | TEXT | подробное описание — свиток «Подробнее» в шапке (миграция `009`); длина не ограничена; `''` — свитка нет |
| price_kopecks | INTEGER NULL | стоимость участия в копейках (миграция `007`); NULL — бесплатно, 0 не хранится (CHECK) |
| hero_fit | TEXT | `cover` (заполнить рамку) / `contain` (режим «Афиша»: целиком, в рамке на подложке), по умолчанию `cover` (миграция `006`) |
| status | TEXT | `draft` / `published` / `archived` (CHECK) |
| created_at, updated_at | TEXT | |

### activities — услуги мероприятия

| Поле | Тип | Примечание |
|---|---|---|
| id | INTEGER PK | |
| event_id | FK → events | `ON DELETE CASCADE` |
| title, short_description, long_description | TEXT | |
| start_time | TEXT NULL | `HH:MM` |
| duration_text | TEXT NULL | |
| pricing_type | TEXT | `fixed` / `free` / `contact` |
| fixed_price_kopecks | INTEGER NULL | CHECK: fixed > 0, free = 0, contact = NULL |
| price_suffix | TEXT NULL | подпись после цены или вместо неё (для contact) |
| card_image | TEXT NULL | |
| details | TEXT | JSON-массив строк (CHECK `json_valid`) |
| sort_order | INTEGER | порядок в анкете |
| is_active | INTEGER | 0/1; выключенная услуга скрыта публично |
| created_at, updated_at | TEXT | |

### activity_images — галерея услуги

`id`, `activity_id` (FK → activities, CASCADE), `image_path`, `alt_text`, `sort_order`.

### registrations — регистрации

| Поле | Примечание |
|---|---|
| id | внутренний id, наружу не выдаётся |
| public_id | UNIQUE, случайный UUID v4 — используется в ссылке `/payment/[public_id]` |
| event_id | FK → events, CASCADE |
| full_name, phone | обязательные данные участника |
| messenger | необязательный контакт; `NULL`, если не указан (пустая строка запрещена CHECK) |
| event_price_kopecks | стоимость участия на момент регистрации (snapshot, миграция `007`); 0 — участие было бесплатным |
| fixed_total_kopecks | итог к оплате на момент регистрации: участие + услуги с фиксированной ценой |
| created_at | |

### registration_activities — snapshots выбранных услуг

| Поле | Примечание |
|---|---|
| registration_id | FK → registrations, CASCADE |
| activity_id | FK → activities, `ON DELETE SET NULL` |
| activity_title_snapshot | название на момент регистрации |
| pricing_type_snapshot | тип цены на момент регистрации |
| fixed_price_kopecks_snapshot | цена на момент регистрации |
| price_suffix_snapshot, start_time_snapshot | подписи на момент регистрации |
| position | порядок услуги в регистрации — как карточки шли в анкете (используется в Excel и уведомлениях) |
| created_at | |

### app_settings — общие настройки (одна строка, `id = 1`)

`payment_method` (`qr` / `phone` / `both`, по умолчанию `qr`), `payment_phone`, `payment_recipient`, `payment_qr_image`, `payment_target_url`, `community_qr_image` (QR Telegram-сообщества), `community_target_url` (ссылка на Telegram), `community_vk_url`, `community_max_url`, `community_title`, `community_description`, `updated_at`.

Миграция `005` добавляет ссылки VK и MAX и заполняет ссылки и новый текст блока только там, где администратор ничего не менял (пустая ссылка, текст по умолчанию). Комментарий в `005` говорит, что QR сообщества не используется, — это устарело: QR возвращён в интерфейс сразу после миграции, колонка `community_qr_image` используется. Применённую миграцию не редактируем, поэтому уточнение записано здесь.

### telegram_notification_outbox — очередь уведомлений

| Поле | Примечание |
|---|---|
| registration_id | UNIQUE, FK → registrations, CASCADE |
| status | `pending` / `sent` / `failed` |
| attempts | число попыток отправки |
| last_error | краткая причина последней ошибки, без токена |
| created_at, last_attempt_at, sent_at | |
| locked_until | захват записи обработчиком (защита от параллельной отправки) |

### schema_migrations — служебная

`version` (имя файла миграции), `checksum` (SHA-256 содержимого), `applied_at`.

## Связи

```text
events 1─* activities 1─* activity_images
events 1─* registrations 1─* registration_activities *─0..1 activities
app_settings — отдельная строка, не связана с мероприятиями
```

## Snapshots

Регистрация хранит копию названия, типа цены, цены и подписи каждой выбранной услуги, а также стоимость участия `event_price_kopecks` и итог `fixed_total_kopecks`. Поэтому:

- изменение названия или цены услуги не меняет прошлые регистрации;
- при удалении услуги snapshot остаётся, а `activity_id` становится `NULL`;
- страница оплаты и админка показывают данные из snapshots.

Итог считает только сервер: из БД берутся активные услуги этого мероприятия, суммируются фиксированные цены. Сумма от клиента не принимается.

## Миграции

- Файлы `db/migrations/NNN_name.sql` применяются по порядку командой `npm run db:migrate`.
- Каждая миграция выполняется в отдельной транзакции и записывается в `schema_migrations` вместе с контрольной суммой.
- Миграция, пересоздающая таблицу, начинается строкой `-- migrate:foreign_keys=off`: мигратор отключает внешние ключи вне транзакции (иначе `DROP TABLE` каскадно удалил бы связанные строки), выполняет миграцию, проверяет `foreign_key_check` и включает ключи обратно.
- `002_optional_messenger_and_snapshot_position.sql` делает мессенджер необязательным (пустые значения → `NULL`) и добавляет `registration_activities.position`; для старых данных порядок восстановлен по возрастанию `id`, что совпадает с порядком вставки.
- `004_payment_methods.sql` добавляет способ оплаты (QR, номер телефона или оба), номер для перевода и имя получателя.
- Уже применённая миграция повторно не выполняется. Если её файл изменён, команда завершится ошибкой: схему меняют только новой миграцией.
- Приложение схему не создаёт. Если миграции не применены, страницы отвечают ошибкой с подсказкой `npm run db:migrate`.
- `npm run db:seed` добавляет демо-мероприятие «Встреча на Рублёвке» и демо-QR, если их ещё нет; существующие данные не перезаписывает.

## Очистка данных

| Действие | Что удаляется | Что остаётся |
|---|---|---|
| Архивирование | ничего | всё; мероприятие скрыто публично |
| Удаление всех регистраций мероприятия | registrations и их snapshots | мероприятие, услуги, фото |
| Удаление услуги | услуга, её галерея и файлы | snapshots в регистрациях |
| Удаление мероприятия навсегда | мероприятие, услуги, галереи, регистрации, snapshots, файлы без других ссылок | общие настройки |

## Резервное копирование (подробно — BACKUP.md)

`npm run backup` создаёт один архив с базой и uploads (см. `BACKUP.md`, восстановление — `RESTORE.md`). Если копировать вручную, то **вместе и в один момент**:

1. файл SQLite (`DATABASE_PATH`) — безопаснее через `sqlite3 rublevka.sqlite ".backup backup.sqlite"` или при остановленном приложении. При копировании файла вручную нужны также `-wal` и `-shm`;
2. каталог загруженных файлов (`UPLOADS_DIR`) целиком.

Без каталога uploads ссылки `upload:` в базе будут вести на отсутствующие изображения; без базы файлы в uploads бесполезны.
