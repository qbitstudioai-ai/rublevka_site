#!/usr/bin/env bash
set -euo pipefail
umask 077

base=/opt/rublevka-staging
config=/opt/rublevka-staging-config
data=/opt/rublevka-staging-data
commit=${1:?Usage: release.sh APPROVED_FULL_COMMIT}
[[ $commit =~ ^[0-9a-f]{40}$ ]] || { echo 'Expected a full commit hash' >&2; exit 2; }

exec 9>/run/lock/rublevka-staging.lock
flock -n 9 || { echo 'Staging backup or release already running' >&2; exit 2; }
export RUBLEVKA_RELEASE=$commit
export SITE_URL
SITE_URL=$(sed -n 's/^SITE_URL=//p' "$config/site.env")
compose() { docker compose -f "$config/compose.yml" "$@"; }

if [[ ! -d $base/repo.git ]]; then
  git init --bare "$base/repo.git"
  git --git-dir="$base/repo.git" remote add origin https://github.com/qbitstudioai-ai/rublevka_site.git
fi
git --git-dir="$base/repo.git" fetch --quiet origin
git --git-dir="$base/repo.git" cat-file -e "$commit^{commit}"
git --git-dir="$base/repo.git" for-each-ref --contains "$commit" --format='%(refname)' refs/remotes/origin/ | grep -q . \
  || { echo 'Commit is absent from the GitHub branches' >&2; exit 2; }

release=$base/releases/$commit
if [[ ! -d $release ]]; then
  pending=$(mktemp -d "$base/releases/.extract.XXXXXXXX")
  trap '[[ -z ${pending:-} ]] || rm -rf -- "$pending"' EXIT
  git --git-dir="$base/repo.git" archive "$commit" -- package.json package-lock.json next.config.ts \
    tsconfig.json next-env.d.ts drizzle.config.ts eslint.config.mjs src public scripts drizzle docs/territory-map/objects.json \
    events-original/package.json events-original/package-lock.json events-original/next.config.ts \
    events-original/tsconfig.json events-original/.dockerignore events-original/Dockerfile events-original/app \
    events-original/components events-original/db events-original/docker events-original/lib events-original/public \
    events-original/scripts events-original/instrumentation.ts events-original/instrumentation-node.ts \
    | tar -xf - -C "$pending"
  mv "$pending" "$release"
  pending=
fi

cp "$config/Dockerfile" "$release/Dockerfile"
cp "$config/site.dockerignore" "$release/.dockerignore"
docker build --build-arg SITE_URL="$SITE_URL" -t "rublevka-staging-site:$commit" "$release"
# Complete the lock metadata for Linux without changing existing non-optional versions.
sed '/^RUN npm ci$/c\
RUN cp package-lock.json /tmp/approved-events.lock \&\& npm install --package-lock-only --ignore-scripts \&\& node -e \x27const fs=require("fs");const a=JSON.parse(fs.readFileSync("/tmp/approved-events.lock")).packages;const b=require("./package-lock.json").packages;for(const [n,p] of Object.entries(a)){if(n \&\& !p.optional \&\& p.version!==b[n]?.version)throw Error("Unexpected locked version change: "+n)}\x27 \&\& npm ci' \
  "$release/events-original/Dockerfile" > "$release/events-original/.staging.Dockerfile"
docker build -f "$release/events-original/.staging.Dockerfile" -t "rublevka-staging-events:$commit" "$release/events-original"

if [[ -f $base/current-commit ]]; then
  previous=$(cat "$base/current-commit")
  if [[ $previous != "$commit" ]]; then
    # Preserve the previous immutable images and data before applying migrations.
    RUBLEVKA_RELEASE=$previous "$config/backup.sh" --locked
  fi
fi

compose up -d --wait db
compose run --rm --no-deps --env-from-file "$config/migration.env" site npm run db:migrate < /dev/null
compose exec -T db psql -Xq -v ON_ERROR_STOP=1 -U rublevka_bootstrap rublevka < "$config/permissions.sql"
if [[ ! -e $data/.cms-seeded ]]; then
  compose run --rm --no-deps site npm run site:seed < /dev/null
  touch "$data/.cms-seeded"
fi
if [[ ! -e $data/events/db/rublevka.sqlite.catalog-loaded ]]; then
  compose run --rm --no-deps --entrypoint node events scripts/init-mounted.mjs < /dev/null
fi

if ! compose up -d --wait --wait-timeout 120 || ! "$config/smoke.sh"; then
  if [[ -n ${previous:-} && $previous != "$commit" ]]; then
    RUBLEVKA_RELEASE=$previous compose up -d --wait --wait-timeout 120
  fi
  echo 'Staging release did not become healthy' >&2
  exit 1
fi
printf '%s\n' "$commit" > "$base/current-commit"
ln -sfn "$release" "$base/current"
printf 'Active release: %s\n' "$commit"
