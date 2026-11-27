#!/usr/bin/env bash
set -euo pipefail
umask 077

config=/opt/rublevka-staging-config
proxy=/opt/supabase/volumes/proxy/caddy
domain=$(sed -n 's|^SITE_URL=https://||p' "$config/site.env")
[[ $domain =~ ^[a-z0-9]+([.-][a-z0-9]+)+$ ]]
exec 9>/run/lock/rublevka-staging-proxy.lock
flock -n 9
candidate=$(mktemp "$proxy/.rublevka-staging.XXXXXXXX")
backup=$(mktemp "$proxy/.rublevka-staging-before.XXXXXXXX")
trap 'rm -f -- "$candidate" "$backup"' EXIT
cp -p "$proxy/Caddyfile" "$backup"

python3 - "$config" "$backup" "$candidate" "$domain" <<'PY'
from pathlib import Path
import sys
config, backup, candidate = map(Path, sys.argv[1:4])
domain = sys.argv[4]
start = "# BEGIN RUBLEVKA STAGING\n"
end = "# END RUBLEVKA STAGING\n"
original = backup.read_text()
if start in original or end in original:
    if original.count(start) != 1 or original.count(end) != 1 or original.index(start) > original.index(end):
        raise SystemExit("Staging block markers are incomplete or duplicated")
    first, block = original.split(start, 1)
    _, remainder = block.split(end, 1)
    original = first + remainder
if any(domain in line.split("{", 1)[0].replace(",", " ").split() for line in original.splitlines() if "{" in line):
    raise SystemExit("Existing site block is outside staging management")
template = (config / "Caddyfile.template").read_text()
values = {
    "STAGING_DOMAIN": domain,
    "STAGING_UPSTREAM": "rublevka-staging-site:3000",
    "STAGING_REVIEW_USER": "review",
    "STAGING_REVIEW_HASH": (config / "reviewer-hash").read_text().strip(),
}
for key, value in values.items():
    template = template.replace("{$" + key + "}", value)
candidate.write_text(original.rstrip() + "\n\n" + start + template + end)
PY

# The shared container's startup command hashes the existing Studio credential
# before running Caddy. CLI processes need that same live hash for validation.
proxy_caddy() {
  docker exec supabase-caddy sh -ec '
    for proc in /proc/[0-9]*/comm; do
      [ "$(cat "$proc" 2>/dev/null)" = caddy ] || continue
      args=$(tr "\000" " " < "${proc%/comm}/cmdline")
      case "$args" in caddy\ run\ *) ;; *) continue ;; esac
      PROXY_AUTH_PASSWORD=$(tr "\000" "\n" < "${proc%/comm}/environ" | sed -n "s/^PROXY_AUTH_PASSWORD=//p")
      [ -n "$PROXY_AUTH_PASSWORD" ] || exit 1
      export PROXY_AUTH_PASSWORD
      exec caddy "$@"
    done
    exit 1
  ' sh "$@"
}

chmod --reference="$proxy/Caddyfile" "$candidate"
proxy_caddy validate --config "/etc/caddy/$(basename "$candidate")" --adapter caddyfile
cmp -s "$proxy/Caddyfile" "$backup" || { echo 'Proxy config changed during validation' >&2; exit 1; }
mv -f "$candidate" "$proxy/Caddyfile"
if ! proxy_caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile; then
  cp -p "$backup" "$proxy/Caddyfile"
  proxy_caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
  exit 1
fi
