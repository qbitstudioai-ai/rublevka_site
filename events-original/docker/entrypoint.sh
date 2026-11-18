#!/bin/sh
# Применяет управляемые миграции (идемпотентно) и запускает сервер.
# exec — чтобы SIGTERM от Docker получил сам Node.js и корректно завершил работу.
set -e
node scripts/db-migrate.mjs
exec node server.js
