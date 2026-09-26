#!/usr/bin/env bash
# Builds (if needed) and serves the REAL CORTEX.OS app against the local backend,
# with the server clock moved to the trailer's business moment (config.mjs → app.fakeNow).
set -euo pipefail
HERE=$(cd "$(dirname "$0")/.." && pwd); REPO=$(cd "$HERE/../.." && pwd)
WORK=${CORTEX_TRAILER_WORK:-$HOME/.cortex-trailer-supabase}
. "$WORK/app.env"
cd "$REPO"
[ -f .next/BUILD_ID ] && [ "${1:-}" != "--build" ] || npx next build
export FAKE_NOW=$(node -e "import('$HERE/config.mjs').then(m => console.log(m.default.app.fakeNow))")
export FAKE_NOW_FILE="$WORK/fake-now.json"
export NODE_OPTIONS="--require $HERE/fake-now.cjs"
exec npx next start -p "${PORT:-3100}"
