#!/usr/bin/env bash
set -euo pipefail
umask 077
backup=$(realpath "${1:?Usage: verify-backup.sh SNAPSHOT_DIRECTORY}")
[[ $backup == /opt/rublevka-staging-backups/* && -f $backup/SHA256SUMS ]]
config=/opt/rublevka-staging-config
export RUBLEVKA_RELEASE
RUBLEVKA_RELEASE=$(cat /opt/rublevka-staging/current-commit)
compose() { docker compose -f "$config/compose.yml" "$@"; }
(cd "$backup" && sha256sum --check SHA256SUMS)
scratch=rublevka_restore_$(openssl rand -hex 6)
compose exec -T db createdb -U rublevka_bootstrap -T template0 "$scratch" < /dev/null
trap 'compose exec -T db dropdb -U rublevka_bootstrap --if-exists "$scratch" < /dev/null' EXIT
compose exec -T db pg_restore -U rublevka_bootstrap --exit-on-error -d "$scratch" < "$backup/postgres.dump"
compose exec -T db psql -XAt -v ON_ERROR_STOP=1 -U rublevka_bootstrap "$scratch" \
  -c 'select count(*) from cms_site_documents' -c 'select count(*) from rublevka_n8n.routes' < /dev/null
cms_media=$(compose exec -T db psql -XAt -v ON_ERROR_STOP=1 -U rublevka_bootstrap "$scratch" \
  -c "select item->>'src' from cms_site_documents, jsonb_array_elements(published->'items') as item where key='media' and item->>'src' like '/cms-media/%'" < /dev/null)
python3 - "$backup/events.sqlite" "$backup/media-config.tar.gz" "$cms_media" <<'PY'
import sqlite3
import sys
import tarfile
from pathlib import Path

with sqlite3.connect(Path(sys.argv[1]).as_uri() + "?mode=ro", uri=True) as db:
    assert db.execute("pragma quick_check").fetchone() == ("ok",)
    assert db.execute("select count(*) from events").fetchone()[0] > 0
    event_media = {row[0][7:] for table, column in (
        ("events", "hero_image"), ("activities", "card_image"), ("activity_images", "image_path"),
        ("app_settings", "payment_qr_image"), ("app_settings", "community_qr_image"),
    ) for row in db.execute(f"select {column} from {table} where {column} like 'upload:%'")}
    print("SQLite restored snapshot is readable")
with tarfile.open(sys.argv[2], "r:gz") as archive:
    names = archive.getnames()
    for required in ("rublevka-staging-config/site.env", "cms-media", "events/uploads"):
        assert required in names, required
    paths = ["events/uploads/" + name for name in event_media] + [name[1:] for name in sys.argv[3].splitlines()]
    for media in paths:
        entry = archive.extractfile(media)
        assert entry and entry.read(1), media
    print("Archived media references and configuration are readable")
PY
