# Развёртывание в production

Документ описывает, что нужно приложению на сервере. Реальное развёртывание, домен, DNS и HTTPS настраиваются отдельно.

## Что ожидает приложение

| Требование | Почему |
|---|---|
| **HTTPS** снаружи | cookie сессии администратора имеет флаг `Secure`; `APP_URL` должен начинаться с `https://` |
| **Reverse proxy** (nginx, Caddy и т.п.) перед приложением | TLS, сжатие, лимит размера запроса; приложение слушает только `127.0.0.1:3000` |
| **Корректные proxy-заголовки** | `Host` (или `X-Forwarded-Host`) — для защиты server actions от CSRF; `X-Real-IP` — для ограничения частоты по IP |
| **Постоянные Docker volume** | база, загрузки и резервные копии не должны пропадать при обновлении образа |
| Один экземпляр приложения | SQLite и ограничение частоты запросов рассчитаны на один процесс |

### Proxy-заголовки и `TRUST_PROXY`

Ограничение частоты (вход в админку, регистрация) определяет IP клиента по заголовкам прокси **только при `TRUST_PROXY=true`**. Без этого все запросы делят общий счётчик: регистрация не ограничивается по IP, а вход в админку ограничен глобально (8 неудачных попыток за 15 минут).

`TRUST_PROXY=true` можно включать, только если:

- контейнер недоступен из интернета напрямую (порт опубликован на `127.0.0.1`, как в `docker-compose.production.yml`);
- прокси **перезаписывает** `X-Real-IP` реальным адресом клиента (nginx: `proxy_set_header X-Real-IP $remote_addr;`).

Иначе любой клиент сможет подставить свой `X-Forwarded-For` и обойти ограничение. Если `X-Real-IP` нет, используется последний адрес из `X-Forwarded-For` — тот, что добавил ваш прокси.

Пример для nginx (только как ориентир):

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    client_max_body_size 32m;   # загрузка фото в админке
}
```

## Переменные окружения

Обязательные в production (без них сервер не запустится и напишет, чего не хватает):

| Переменная | Пример / требование |
|---|---|
| `DATABASE_PATH` | `/data/db/rublevka.sqlite` |
| `UPLOADS_DIR` | `/data/uploads` |
| `APP_URL` | `https://reg.example.ru` — только https (кроме localhost) |
| `ADMIN_USERNAME` | логин администратора |
| `ADMIN_PASSWORD` | не короче 12 символов |
| `ADMIN_SESSION_SECRET` | не короче 32 символов, случайная строка |

Дополнительные:

| Переменная | Назначение |
|---|---|
| `TRUST_PROXY` | `true` за доверенным прокси (см. выше) |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | уведомления; задаются только парой, иначе запуск остановится |
| `BACKUP_DIR`, `BACKUP_RETENTION_DAYS` | резервные копии (`/data/backups`, по умолчанию 30 дней) |
| `ADMIN_COOKIE_SECURE=false` | только для временной работы без HTTPS |

Пути данных не должны указывать внутрь `.next/` или `node_modules/` (каталоги сборки пересоздаются) — сервер это проверяет при запуске.

## Docker

Файлы: `Dockerfile`, `docker/entrypoint.sh`, `docker-compose.production.yml`, `.dockerignore`.

- **Multi-stage:** зависимости → сборка (`next build` + `scripts/prepare-standalone.mjs`) → runtime-образ на `node:24-bookworm-slim`.
- **Standalone:** в образе только `server.js`, нужные `node_modules` (включая `better-sqlite3` и полный `sharp`), статика, `public`, SQL-миграции и CLI-скрипты на чистом JS.
- **Без секретов и данных:** `.dockerignore` исключает `.env*`, `data/`, `backups/`; `prepare-standalone` дополнительно удаляет из сборки случайно захваченные каталоги данных.
- **Непривилегированный пользователь** `node`; каталоги `/data/*` принадлежат ему.
- **При старте** `entrypoint.sh` применяет миграции (`node scripts/db-migrate.mjs`, идемпотентно) и через `exec` запускает `node server.js`, чтобы сигналы Docker доходили до Node.js.
- **Healthcheck** образа обращается к `/api/health`.

### Volume

| Volume | Путь в контейнере | Содержимое |
|---|---|---|
| `rublevka_db` | `/data/db` | SQLite (`rublevka.sqlite` + `-wal`/`-shm`) |
| `rublevka_uploads` | `/data/uploads` | фото мероприятий и услуг, QR |
| `rublevka_backups` | `/data/backups` | архивы `rublevka-backup-*.tar.gz` |

Volume с бэкапами желательно дополнительно копировать за пределы сервера (см. `BACKUP.md`).

### Запуск (пример)

```bash
cp .env.example .env.production      # заполнить реальными значениями, не коммитить
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml exec app node scripts/db-seed.mjs   # только для демо-данных
curl -s http://127.0.0.1:3000/api/health
```

### Проверка образа

На машине с Docker: `sh scripts/docker-smoke.sh`. Скрипт собирает образ, проверяет отсутствие секретов и данных в нём, запускает контейнер с read-only корневой ФС на временных volume, ждёт `/api/health`, делает seed и бэкап, останавливает контейнер по SIGTERM и проверяет корректное закрытие SQLite.

## Регулярные задачи (cron на сервере)

```cron
# Повтор неотправленных Telegram-уведомлений — каждые 10 минут
*/10 * * * * cd /srv/rublevka && docker compose -f docker-compose.production.yml exec -T app node scripts/telegram-retry.mjs >> /var/log/rublevka-telegram.log 2>&1
# Резервная копия — ежедневно в 03:30
30 3 * * * cd /srv/rublevka && docker compose -f docker-compose.production.yml exec -T app node scripts/backup.mjs >> /var/log/rublevka-backup.log 2>&1
```

`telegram-retry` завершается с кодом 2, если часть уведомлений не отправилась, — это удобно для мониторинга.

## Оплата

Реквизиты оплаты (QR-код и/или номер телефона для перевода) настраиваются в админпанели после запуска: «Настройки» → «Оплата».

## Мониторинг

`GET /api/health` → `200 {"status":"ok", ...}` или `503 {"status":"degraded", ...}`. Проверяются доступность SQLite, применённые миграции и доступность каталога uploads. Ответ не содержит путей, секретов и текстов ошибок; Telegram при проверке не вызывается.

## Остановка и обновление

- Next.js обрабатывает SIGTERM: закрывает сервер и завершает процесс; при выходе приложение закрывает SQLite (WAL сбрасывается в файл базы).
- Уведомления, которые не успели отправиться, остаются в outbox (`pending`) и уйдут после запуска — командой `telegram-retry` (cron) или кнопкой «Повторить неотправленные» в админке.
- Обновление: сделать бэкап → `docker compose ... up -d --build` → проверить `/api/health`.

## Проверено и не проверено

- Production-артефакт (`.next/standalone/server.js`) проходит все e2e-тесты в режиме `NODE_ENV=production`: регистрация, загрузка фото (sharp), Excel, Telegram (mock), health.
- Код путей и файлов использует только `path`/`fs` без привязки к Windows. Образ собран и запущен на Linux-сервере 22.10.2026 (см. ниже): `better-sqlite3` и `sharp` работают, секретов в образе нет, health — `ok`. Полный `scripts/docker-smoke.sh` там не запускался.

## Текущее размещение: meropriyatiya.allqbit.ru (развёрнуто 22.10.2026)

Сервер `72.56.6.85` (Ubuntu 22.04) общий: на нём Supabase и сайт allqbit.ru. Раскладка повторяет allqbit:

| Путь | Что это |
|---|---|
| `/opt/rublevka` | код — `git archive` коммита (`DEPLOYED_COMMIT`). При обновлении заменяется целиком |
| `/opt/rublevka-data/compose.yml` | compose-файл сервера: контейнер `rublevka-registration`, сеть `supabase_default`, без портов наружу |
| `/opt/rublevka-data/production.env` | секреты и настройки (права 600) |
| `/opt/rublevka-data/{db,uploads,backups}` | SQLite, фото/QR, резервные копии — обычные каталоги (UID 1000), **не** docker volume |

- **HTTPS и домен** — общий Caddy (`supabase-caddy`, конфиг `/opt/supabase/volumes/proxy/caddy/Caddyfile`, блок `meropriyatiya.allqbit.ru` → `reverse_proxy rublevka-registration:3000` с `header_up X-Real-IP {remote_host}`). Сертификат Let's Encrypt Caddy выпускает и продлевает сам.
- **Перезагрузка Caddy** после правки Caddyfile — только с хэшированием пароля Studio, как при старте контейнера (обычный `caddy validate/reload` падает на `basic_auth`):
  ```bash
  P='export PROXY_AUTH_PASSWORD=$(caddy hash-password --plaintext "$PROXY_AUTH_PASSWORD")'
  docker exec supabase-caddy sh -c "$P && caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile" && \
  docker exec supabase-caddy sh -c "$P && caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile"
  ```
- **Почему не docker volume:** в crontab сервера еженедельно выполняется `docker system prune -af --volumes`.
- **Cron:** `telegram-retry` каждые 10 минут, `backup` ежедневно в 03:45 (`docker exec rublevka-registration …`, логи `/var/log/rublevka-*.log`).
- **Seed не запускался** — база чистая; реквизиты оплаты и QR задаются в админке.

**Изменить настройки** (`production.env`): `nano /opt/rublevka-data/production.env`, затем `cd /opt/rublevka-data && docker compose up -d --force-recreate` (`restart` файл не перечитывает).

**Обновить код** (с рабочей машины, из каталога репозитория, после коммита):
```bash
git archive --format=tar HEAD | ssh root@72.56.6.85 'set -e; rm -rf /opt/rublevka.new && mkdir /opt/rublevka.new && tar -x -C /opt/rublevka.new && rm -rf /opt/rublevka && mv /opt/rublevka.new /opt/rublevka'
ssh root@72.56.6.85 'docker exec rublevka-registration node scripts/backup.mjs && cd /opt/rublevka-data && docker compose up -d --build'
```
Миграции применяются автоматически при старте контейнера. Если `ssh` обрывается с «Connection closed» сразу после подключения — отключите VPN на рабочей машине.
