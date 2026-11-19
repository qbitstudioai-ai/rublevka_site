# Восстановление из резервной копии

Восстановление выполняется вручную на сервере. Из админпанели восстановление намеренно недоступно: оно заменяет все текущие данные.

Примеры даны для Docker Compose (`docker-compose.production.yml`, volume `rublevka_db`, `rublevka_uploads`, `rublevka_backups`). Имена volume могут иметь префикс проекта — проверьте `docker volume ls`.

## 1. Остановить приложение

```bash
cd /srv/rublevka
docker compose -f docker-compose.production.yml stop app
```

Остановка нужна, чтобы во время восстановления никто не зарегистрировался и SQLite не держал файл открытым.

## 2. Выбрать резервную копию

```bash
docker run --rm -v rublevka_backups:/backups alpine ls -l /backups
```

Выберите архив `rublevka-backup-ГГГГММДД-ЧЧММССZ.tar.gz` (время в UTC). Распакуйте его во временный каталог и посмотрите манифест:

```bash
mkdir -p /tmp/restore && cd /tmp/restore
docker run --rm -v rublevka_backups:/backups -v /tmp/restore:/restore alpine \
  tar -xzf /backups/rublevka-backup-20261016-033000Z.tar.gz -C /restore
cat /tmp/restore/manifest.json
```

Перед заменой данных рекомендуется сделать ещё одну копию текущего состояния: `docker compose ... run --rm app node scripts/backup.mjs` (или скопировать volume).

## 3. Восстановить SQLite

Удалите текущую базу вместе с файлами `-wal` и `-shm` (они относятся к старой базе) и положите файл из архива:

```bash
docker run --rm -v rublevka_db:/data/db -v /tmp/restore:/restore alpine sh -c '
  rm -f /data/db/rublevka.sqlite /data/db/rublevka.sqlite-wal /data/db/rublevka.sqlite-shm &&
  cp /restore/database/rublevka.sqlite /data/db/rublevka.sqlite'
```

## 4. Восстановить uploads

```bash
docker run --rm -v rublevka_uploads:/data/uploads -v /tmp/restore:/restore alpine sh -c '
  find /data/uploads -mindepth 1 -delete &&
  cp -a /restore/uploads/. /data/uploads/'
```

## 5. Проверить права

Приложение работает от пользователя `node` (uid 1000) и должно иметь право записи:

```bash
docker run --rm -v rublevka_db:/data/db -v rublevka_uploads:/data/uploads alpine \
  chown -R 1000:1000 /data/db /data/uploads
```

## 6. Применить миграции

Если копия сделана на более старой версии приложения, миграции её обновят (они идемпотентны; при запуске контейнера выполняются автоматически, но лучше увидеть результат явно):

```bash
docker compose -f docker-compose.production.yml run --rm app node scripts/db-migrate.mjs
```

## 7. Запустить приложение

```bash
docker compose -f docker-compose.production.yml start app
```

## 8. Проверить

```bash
curl -s http://127.0.0.1:3000/api/health
# {"status":"ok","checks":{"database":"ok","migrations":"ok","uploads":"ok"},...}
```

Затем откройте админпанель: мероприятия, регистрации и фотографии должны совпадать с манифестом. Удалите `/tmp/restore` — там персональные данные.

## Без Docker

Те же шаги: остановить процесс, заменить файл `DATABASE_PATH` (удалив `-wal`/`-shm`), заменить содержимое `UPLOADS_DIR`, выполнить `npm run db:migrate`, запустить приложение и проверить `/api/health`.
