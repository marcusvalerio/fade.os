#!/usr/bin/env bash
# Creates the demo owner in the LOCAL Supabase (GoTrue admin API) and prints its id.
set -euo pipefail
API=${SUPABASE_URL:-http://127.0.0.1:54321}
KEY=${SUPABASE_SERVICE_ROLE_KEY:?set SUPABASE_SERVICE_ROLE_KEY (npx supabase status)}
curl -sS -X POST "$API/auth/v1/admin/users" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"email":"rafael@norte21.demo","password":"cortex-demo-2026","email_confirm":true,"user_metadata":{"name":"Rafael Duarte"}}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id') or d)"
