#!/usr/bin/env bash
# dev-web.sh — reliably start vercel dev for task.local.nself.org
# Pins node 24 (vercel is incompatible with node 25), frees port 3017,
# runs from the monorepo root (Vercel project rootDirectory=ntask), injects
# backend function env from ntask/backend/.env.secrets.
set -euo pipefail
source ~/.claude/vault.env 2>/dev/null || true
N24=/Users/admin/.nvm/versions/node/v24.6.0/bin
BE=/Volumes/UG/Sites/nself/ntask/backend
HAS=$(grep '^HASURA_GRAPHQL_ADMIN_SECRET=' "$BE/.env.secrets" | cut -d= -f2-)
KEY=$(python3 -c "import json,re;s=open('$BE/.env.secrets').read();m=re.search(r'^HASURA_GRAPHQL_JWT_SECRET=(.*)\$',s,re.M);v=m.group(1).strip().strip('\"').strip(\"'\");print(json.loads(v)['key'] if v.startswith('{') else v)")
pkill -9 -f "vercel dev" 2>/dev/null || true
PID=$(lsof -tnP -iTCP:3017 -sTCP:LISTEN 2>/dev/null || true); [ -n "$PID" ] && kill -9 $PID 2>/dev/null || true
sleep 1
export PATH="$N24:/opt/homebrew/bin:/usr/local/bin:$PATH"
cd /Volumes/UG/Sites/nself/web
# resolve live backend ports from docker (container names ntask_* per nself>=1.2, legacy backend_*)
HP=$(docker port ntask_hasura 8080/tcp 2>/dev/null || docker port backend_hasura 8080/tcp 2>/dev/null); HP=${HP##*:}; HP=${HP:-8080}
AP=$(docker port ntask_auth 4000/tcp 2>/dev/null || docker port ntask_auth 4001/tcp 2>/dev/null || docker port backend_auth 4000/tcp 2>/dev/null); AP=${AP##*:}; AP=${AP:-4000}
exec env AUTH_INTERNAL_URL=http://localhost:$AP GRAPHQL_INTERNAL_URL=http://localhost:$HP/v1/graphql \
  HASURA_ADMIN_SECRET="$HAS" AUTH_HS256_KEY="$KEY" \
  "$N24/vercel" dev --listen 3017 --yes --token "$VERCEL_TOKEN"
