#!/usr/bin/env bash
# seed-prod.sh — Production-only owner seed.
#
# Purpose:
#   Seeds ONLY the owner account (Aric) with email aliases and owner role.
#   Idempotent: safe to re-run. Never creates duplicate accounts.
#   Does NOT create test users or mock data (dev use only — see seed-dev.sh).
#
# Owner identity:
#   Primary email:  alisalaah@gmail.com
#   Aliases:        aric.camarata@gmail.com, ali@camarata.com
#   Role:           owner
#   Password:       from $NSELF_OWNER_PASSWORD (vault); if unset → reset-required flag set.
#
# Usage:
#   NSELF_OWNER_PASSWORD=<vault pw> ./scripts/seed-prod.sh
#   (auto-run by `make seed-prod`; not run by `make up` which calls seed-dev.sh)
#
# Guard: only runs if BASE_DOMAIN is NOT local/staging.
set -euo pipefail
cd "$(dirname "$0")/.."

BASE_DOMAIN="$(grep -h '^BASE_DOMAIN=' .env.dev .env 2>/dev/null | tail -1 | cut -d= -f2- || echo "")"

# Prod guard: refuse if this looks like local/staging
case "$BASE_DOMAIN" in
  *local*|*localhost*|*staging*|"")
    # Allow override for testing: FORCE_PROD_SEED=1
    if [ "${FORCE_PROD_SEED:-0}" != "1" ]; then
      echo "INFO: BASE_DOMAIN='$BASE_DOMAIN' looks like local/staging — prod seed skipped." >&2
      echo "      Set FORCE_PROD_SEED=1 to override (for testing only)." >&2
      exit 0
    fi
    echo "WARN: FORCE_PROD_SEED=1 — running prod seed on non-prod domain." >&2
    ;;
esac

AUTH_URL="${AUTH_URL:-http://localhost:4000}"
PG_CONTAINER="${PG_CONTAINER:-${NSELF_PROJECT_NAME:-ntask}_postgres}"
docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER" || PG_CONTAINER="backend_postgres"
PG_DB="${PG_DB:-nself}"

OWNER_EMAIL="alisalaah@gmail.com"
OWNER_ALIASES=("aric.camarata@gmail.com" "ali@camarata.com")
OWNER_PW="${NSELF_OWNER_PASSWORD:-}"

echo "→ [seed-prod] Seeding roles + permissions (all envs)"
docker exec -i "$PG_CONTAINER" psql -U postgres -d "$PG_DB" -q < postgres/seed/001_roles_permissions.sql
echo "  roles/permissions seeded."

echo "→ [seed-prod] Seeding owner account: $OWNER_EMAIL"

# Determine if owner already exists (by any of the 3 emails)
EXISTING_ID=$(docker exec -i "$PG_CONTAINER" psql -U postgres -d "$PG_DB" -tAq <<SQL 2>/dev/null
SELECT u.id FROM auth.users u
LEFT JOIN public.user_emails ue ON ue.user_id = u.id
WHERE u.email = '$OWNER_EMAIL'
   OR ue.email ILIKE '$OWNER_EMAIL'
   OR ue.email ILIKE 'aric.camarata@gmail.com'
   OR ue.email ILIKE 'ali@camarata.com'
LIMIT 1;
SQL
)
EXISTING_ID="${EXISTING_ID// /}"

if [ -z "$EXISTING_ID" ]; then
  echo "  Owner does not exist — creating..."
  if [ -z "$OWNER_PW" ]; then
    echo "  WARN: NSELF_OWNER_PASSWORD is unset — creating with random PW + reset-required flag."
    OWNER_PW="$(openssl rand -hex 24)"
    RESET_REQUIRED=1
  else
    RESET_REQUIRED=0
  fi

  code=$(curl -s -o /tmp/owner_signup.json -w '%{http_code}' \
    -X POST "$AUTH_URL/signup/email-password" \
    -H 'content-type: application/json' \
    -d "{\"email\":\"$OWNER_EMAIL\",\"password\":\"$OWNER_PW\"}" || echo 000)

  case "$code" in
    200|201) echo "  + created $OWNER_EMAIL" ;;
    409|400) echo "  = $OWNER_EMAIL already exists (auth API says so)" ;;
    *) echo "  ! signup HTTP $code"; cat /tmp/owner_signup.json; exit 1 ;;
  esac

  # Mark email verified
  docker exec -i "$PG_CONTAINER" psql -U postgres -d "$PG_DB" -q <<SQL
UPDATE auth.users SET email_verified = true WHERE email = '$OWNER_EMAIL';
SQL

  if [ "${RESET_REQUIRED:-0}" = "1" ]; then
    docker exec -i "$PG_CONTAINER" psql -U postgres -d "$PG_DB" -q <<SQL
-- mark password reset required by setting a marker in metadata (app checks this)
UPDATE auth.users
  SET metadata = jsonb_set(COALESCE(metadata,'{}'), '{password_reset_required}', 'true')
WHERE email = '$OWNER_EMAIL';
SQL
    echo "  WARN: Password reset required on next login (set NSELF_OWNER_PASSWORD in vault)."
  fi
fi

# Get the owner ID (create succeeded or already existed)
OWNER_ID=$(docker exec -i "$PG_CONTAINER" psql -U postgres -d "$PG_DB" -tAq \
  -c "SELECT id FROM auth.users WHERE email = '$OWNER_EMAIL' LIMIT 1;" 2>/dev/null)
OWNER_ID="${OWNER_ID// /}"

if [ -z "$OWNER_ID" ]; then
  echo "ERROR: Could not determine owner user ID after signup. Aborting." >&2
  exit 1
fi
echo "  Owner ID: $OWNER_ID"

# Add alias emails
echo "→ [seed-prod] Adding alias emails..."
for alias_email in "${OWNER_ALIASES[@]}"; do
  docker exec -i "$PG_CONTAINER" psql -U postgres -d "$PG_DB" -q <<SQL
INSERT INTO public.user_emails (user_id, email, is_primary, verified)
VALUES ('$OWNER_ID', '$alias_email', false, true)
ON CONFLICT (email) DO NOTHING;
SQL
  echo "  alias: $alias_email"
done

# Ensure primary email row exists
docker exec -i "$PG_CONTAINER" psql -U postgres -d "$PG_DB" -q <<SQL
INSERT INTO public.user_emails (user_id, email, is_primary, verified)
VALUES ('$OWNER_ID', '$OWNER_EMAIL', true, true)
ON CONFLICT (email) DO UPDATE SET is_primary = true, verified = true;
SQL

# Assign owner role (idempotent via public.user_roles trigger → auth.user_roles)
echo "→ [seed-prod] Assigning owner role..."
docker exec -i "$PG_CONTAINER" psql -U postgres -d "$PG_DB" -q <<SQL
DO \$\$
DECLARE
  v_role_id UUID;
BEGIN
  SELECT id INTO v_role_id FROM public.roles WHERE key = 'owner';
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'owner role not found — run roles seed first';
  END IF;

  -- Insert into public.user_roles (trigger syncs to auth.user_roles + sets default_role)
  INSERT INTO public.user_roles (user_id, role_id)
  VALUES ('$OWNER_ID', v_role_id)
  ON CONFLICT DO NOTHING;

  -- Ensure auth.users.default_role = owner (sync trigger fires on insert, but be safe)
  UPDATE auth.users SET default_role = 'owner' WHERE id = '$OWNER_ID';
END
\$\$;
SQL

echo "→ [seed-prod] Verifying..."
docker exec -i "$PG_CONTAINER" psql -U postgres -d "$PG_DB" <<SQL
SELECT
  u.email,
  u.default_role,
  (SELECT string_agg(r.role, ', ' ORDER BY r.role) FROM auth.user_roles r WHERE r.user_id = u.id) AS auth_roles,
  (SELECT count(*) FROM public.user_emails ue WHERE ue.user_id = u.id) AS alias_count
FROM auth.users u
WHERE u.id = '$OWNER_ID';
SQL

echo "→ [seed-prod] Done. Owner '$OWNER_EMAIL' seeded with owner role."
