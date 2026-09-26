#!/usr/bin/env bash
# Boots a LOCAL Supabase with the real CORTEX.OS schema and the demo barbershop.
# Needs Docker. Nothing here touches the production project.
#   ./scripts/setup-backend.sh           # first run, or --reset to wipe and reseed
set -euo pipefail
HERE=$(cd "$(dirname "$0")/.." && pwd); REPO=$(cd "$HERE/../.." && pwd)
WORK=${CORTEX_TRAILER_WORK:-$HOME/.cortex-trailer-supabase}
SB="npx -y supabase@2"
mkdir -p "$WORK" && cd "$WORK"
[ -f supabase/config.toml ] || $SB init --force >/dev/null
if [ "${1:-}" = "--reset" ]; then $SB stop --no-backup >/dev/null 2>&1 || true; fi
$SB start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,postgres-meta,mailpit >/dev/null
eval "$($SB status -o env 2>/dev/null | sed 's/^/export SB_/')"
export PGPASSWORD=postgres; PSQL="psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -q"
if [ "$($PSQL -Atc "select count(*) from information_schema.tables where table_name='company'")" = "0" ]; then
  echo "applying migrations (two passes: the prod schema has objects that predate the migrations)"
  for pass in 1 2; do
    for f in "$REPO"/supabase/migrations/*.sql; do $PSQL -v ON_ERROR_STOP=0 -f "$f" >/dev/null 2>&1 || true; done
    $PSQL -f "$HERE/seed/local-schema-fixups.sql" >/dev/null 2>&1
  done
  $PSQL -c "notify pgrst, 'reload schema'"
fi
if [ "$($PSQL -Atc "select count(*) from public.company")" = "0" ]; then
  OWNER=$(SUPABASE_SERVICE_ROLE_KEY=$SB_SERVICE_ROLE_KEY "$HERE/seed/create-user.sh")
  $PSQL -v owner="$OWNER" -f "$HERE/seed/seed.sql"
fi
cat > "$WORK/app.env" <<ENV
export NEXT_PUBLIC_SUPABASE_URL=$SB_API_URL
export NEXT_PUBLIC_SUPABASE_ANON_KEY=$SB_ANON_KEY
export SUPABASE_SERVICE_ROLE_KEY=$SB_SERVICE_ROLE_KEY
export NEXT_TELEMETRY_DISABLED=1
ENV
echo "backend ready → $WORK/app.env"
