#!/usr/bin/env bash
set -euo pipefail
umask 077
base=/opt/rublevka-staging
config=/opt/rublevka-staging-config
data=/opt/rublevka-staging-data
backups=/opt/rublevka-staging-backups

if [[ ${1:-} != --locked ]]; then
  exec 9>/run/lock/rublevka-staging.lock
  flock -w 120 9
fi
export RUBLEVKA_RELEASE=${RUBLEVKA_RELEASE:-$(cat "$base/current-commit")}
compose() { docker compose -f "$config/compose.yml" "$@"; }
pending=$(mktemp -d "$backups/.backup.XXXXXXXX")
snapshot=staging-snapshot-$(basename "$pending").sqlite
trap 'rm -rf -- "$pending"; rm -f -- "$data/events/backups/$snapshot"' EXIT

compose exec -T db pg_dump -U rublevka_bootstrap -Fc rublevka < /dev/null > "$pending/postgres.dump"
compose exec -T db pg_dumpall -U rublevka_bootstrap --globals-only < /dev/null > "$pending/postgres-roles.sql"
compose exec -T events node -e '
  const Database = require("better-sqlite3");
  const db = new Database(process.env.DATABASE_PATH, { readonly: true });
  db.backup("/data/backups/" + process.argv[1]).then(() => db.close()).catch(() => process.exit(1));
' "$snapshot" < /dev/null
cp "$data/events/backups/$snapshot" "$pending/events.sqlite"
tar -czf "$pending/media-config.tar.gz" -C /opt rublevka-staging-config \
  -C "$data" cms-media events/uploads
printf '%s\n' "$RUBLEVKA_RELEASE" > "$pending/commit"
(cd "$pending" && sha256sum postgres.dump postgres-roles.sql events.sqlite media-config.tar.gz commit > SHA256SUMS)
destination="$backups/$(date -u +%Y%m%dT%H%M%SZ)-$(basename "$pending" | cut -d. -f3)"
mv "$pending" "$destination"
find "$backups" -mindepth 1 -maxdepth 1 -type d -name '20*T*Z-*' -mtime +14 -exec rm -rf -- {} +
printf 'Backup verified for checksums: %s\n' "$destination"
