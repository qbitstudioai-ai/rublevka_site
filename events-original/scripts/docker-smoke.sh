#!/bin/sh
# Smoke-тест production-образа на машине с Docker (Linux/macOS). Не трогает production-данные:
# использует временные volume и тестовые значения. Запуск: sh scripts/docker-smoke.sh
set -eu

IMAGE=rublevka-registration:smoke
NAME=rublevka-smoke
PORT=3399
SUFFIX=$(date +%s)
VOLUMES="rublevka_smoke_db_$SUFFIX rublevka_smoke_uploads_$SUFFIX rublevka_smoke_backups_$SUFFIX"

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  for volume in $VOLUMES; do docker volume rm "$volume" >/dev/null 2>&1 || true; done
}
trap cleanup EXIT

echo "1. Сборка образа"
docker build -t "$IMAGE" .

echo "2. В образе нет секретов и локальных данных"
docker run --rm --entrypoint sh "$IMAGE" -c 'test ! -e /app/.env && test ! -e /app/.env.local && test ! -d /app/data && test -z "$(ls -A /data/db)" && id -u' | grep -qv '^0$'

echo "3. Запуск с read-only корневой ФС (запись только в volume и tmpfs)"
set -- $VOLUMES
docker run -d --name "$NAME" -p "127.0.0.1:$PORT:3000" --read-only --tmpfs /tmp --tmpfs /app/.next/cache \
  -e APP_URL="http://127.0.0.1:$PORT" -e ADMIN_USERNAME=smoke -e ADMIN_PASSWORD=smoke-password-123 \
  -e ADMIN_SESSION_SECRET=smoke-secret-0123456789abcdef0123456789 -e TRUST_PROXY=true \
  -v "$1:/data/db" -v "$2:/data/uploads" -v "$3:/data/backups" "$IMAGE" >/dev/null

echo "4. Ожидание /api/health"
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS "http://127.0.0.1:$PORT/api/health" | grep -q '"status":"ok"'

echo "5. Seed и бэкап из контейнера (Excel формируется в памяти — read-only ФС это подтверждает при выгрузке)"
docker exec "$NAME" node scripts/db-seed.mjs
docker exec "$NAME" node scripts/backup.mjs
docker exec "$NAME" sh -c 'ls /data/backups | grep -q "^rublevka-backup-"'
curl -fsS "http://127.0.0.1:$PORT/event/vstrecha-na-rublevke" >/dev/null

echo "6. Корректная остановка (SIGTERM)"
docker stop -t 30 "$NAME" >/dev/null
CODE=$(docker inspect -f '{{.State.ExitCode}}' "$NAME")
[ "$CODE" = "143" ] || [ "$CODE" = "0" ] || { echo "Неожиданный код выхода: $CODE"; exit 1; }
docker run --rm -v "$1:/data/db" --entrypoint sh "$IMAGE" -c 'test ! -s /data/db/rublevka.sqlite-wal'

echo "Smoke-тест пройден."
