# syntax=docker/dockerfile:1
# Production-образ: multi-stage, standalone-сборка Next.js, запуск от непривилегированного пользователя.
# Данные (SQLite, uploads, backups) не хранятся в образе — только в volume /data/*.

ARG NODE_VERSION=24-bookworm-slim

# ---------- 1. Зависимости (включая dev — нужны для сборки) ----------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
# Инструменты на случай сборки better-sqlite3 из исходников (если нет готового бинарника).
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ---------- 2. Сборка ----------
FROM node:${NODE_VERSION} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# next build + prepare-standalone: .next/standalone с server.js, нужными node_modules,
# полным sharp, статикой, public и SQL-миграциями.
RUN npm run build

# ---------- 3. Runtime ----------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_PATH=/data/db/rublevka.sqlite \
    UPLOADS_DIR=/data/uploads \
    BACKUP_DIR=/data/backups

# Каталоги данных создаются пустыми и принадлежат пользователю node; содержимое — в volume.
RUN mkdir -p /data/db /data/uploads /data/backups && chown -R node:node /data

COPY --from=build --chown=node:node /app/.next/standalone ./
# CLI-скрипты (миграции, seed, бэкап, повтор Telegram) и их модули на чистом JS.
COPY --from=build --chown=node:node /app/db ./db
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/lib/shared/*.mjs ./lib/shared/
COPY --from=build --chown=node:node /app/lib/server/*.mjs ./lib/server/
COPY --chown=node:node docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x ./docker/entrypoint.sh

USER node
EXPOSE 3000
VOLUME ["/data/db", "/data/uploads", "/data/backups"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["./docker/entrypoint.sh"]
