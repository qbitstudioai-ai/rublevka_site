#!/usr/bin/env bash
set -euo pipefail
umask 077

domain=${1:?Usage: bootstrap.sh DOMAIN APPROVED_FULL_COMMIT SQL_FILE}
commit=${2:?Missing approved commit}
sql=${3:?Missing 03_setup.sql}
[[ $domain =~ ^[a-z0-9]+([.-][a-z0-9]+)+$ && $commit =~ ^[0-9a-f]{40}$ ]]
config=/opt/rublevka-staging-config
data=/opt/rublevka-staging-data
[[ ! -e $config/site.env && ! -e $data/postgres/PG_VERSION ]] || { echo 'Staging already initialized' >&2; exit 2; }

install -d -m 0700 /opt/rublevka-staging/releases /opt/rublevka-staging-backups "$config" "$data"
install -d -m 0700 "$data/postgres"
install -d -m 0750 -o 1000 -g 1000 "$data/cms-media" "$data/events/db" "$data/events/uploads" "$data/events/backups"

secret() { openssl rand -hex "${1:-32}"; }
bootstrap_password=$(secret)
owner_password=$(secret)
site_password=$(secret)
n8n_password=$(secret)
events_key=$(secret)
cms_password=$(secret 18)
events_password=$(secret 18)

cat > "$config/postgres.env" <<EOF
POSTGRES_USER=rublevka_bootstrap
POSTGRES_PASSWORD=$bootstrap_password
POSTGRES_DB=postgres
EOF

cat > "$config/site.env" <<EOF
SITE_URL=https://$domain
SEO_INDEXING_ENABLED=false
CMS_ENABLED=true
CMS_MEDIA_DIR=/data/cms-media
DATABASE_URL=postgresql://rublevka_app:$site_password@rublevka-staging-postgres:5432/rublevka
SITE_ADMIN_SESSION_SECRET=$(secret)
EVENTS_ORIGINAL_ORIGIN=http://events:3000
ASSISTANT_CHAT_ENABLED=false
ASSISTANT_KNOWLEDGE_KEY=$(secret)
ASSISTANT_EVENTS_KEY=$events_key
ASSISTANT_N8N_WEBHOOK_URL=
ASSISTANT_N8N_WEBHOOK_KEY=$(secret)
ASSISTANT_N8N_CALLBACK_KEY=$(secret)
ASSISTANT_OPERATOR_KEY=$(secret)
ASSISTANT_RETENTION_HOURS=24
EOF

printf 'DATABASE_URL=postgresql://rublevka_owner:%s@rublevka-staging-postgres:5432/rublevka\n' "$owner_password" > "$config/migration.env"

cat > "$config/events.env" <<EOF
APP_URL=https://$domain
EVENTS_ASSISTANT_MOUNTED=true
ASSISTANT_EVENTS_KEY=$events_key
ADMIN_USERNAME=events-admin
ADMIN_PASSWORD=$events_password
ADMIN_SESSION_SECRET=$(secret)
EOF

cat > "$config/reviewer-access" <<EOF
SITE_ADMIN_USERNAME=site-admin
SITE_ADMIN_PASSWORD=$cms_password
EVENTS_ADMIN_USERNAME=events-admin
EVENTS_ADMIN_PASSWORD=$events_password
EOF
printf 'RUBLEVKA_N8N_USER=rublevka_n8n\nRUBLEVKA_N8N_PASSWORD=%s\n' "$n8n_password" > "$config/n8n-db.env"

export RUBLEVKA_RELEASE=$commit
compose() { docker compose -f "$config/compose.yml" "$@"; }
compose up -d --wait --wait-timeout 120 db
compose exec -T db psql -Xq -v ON_ERROR_STOP=1 -U rublevka_bootstrap postgres <<EOF
CREATE ROLE rublevka_owner LOGIN PASSWORD '$owner_password';
CREATE ROLE rublevka_app LOGIN PASSWORD '$site_password';
CREATE ROLE rublevka_n8n LOGIN PASSWORD '$n8n_password';
CREATE DATABASE rublevka OWNER rublevka_owner;
REVOKE ALL ON DATABASE rublevka FROM PUBLIC;
GRANT CONNECT ON DATABASE rublevka TO rublevka_app, rublevka_n8n;
REVOKE CONNECT ON DATABASE postgres FROM PUBLIC;
REVOKE CONNECT ON DATABASE template1 FROM PUBLIC;
EOF

compose exec -T db psql -Xq -v ON_ERROR_STOP=1 -U rublevka_bootstrap rublevka <<'EOF'
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO rublevka_app;
EOF

compose exec -T db psql -Xq -v ON_ERROR_STOP=1 -U rublevka_bootstrap rublevka < "$sql"
"$config/release.sh" "$commit"
admin_env=$(mktemp "$config/.admin.XXXXXXXX")
trap 'rm -f -- "$admin_env"' EXIT
grep -E '^SITE_ADMIN_(USERNAME|PASSWORD)=' "$config/reviewer-access" > "$admin_env"
compose run --rm -T --no-deps --env-from-file "$admin_env" site npm run site:admin:create -- --from-env < /dev/null
