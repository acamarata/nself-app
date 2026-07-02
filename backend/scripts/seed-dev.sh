#!/usr/bin/env bash
# seed-dev.sh — pre-fill LOCAL/STAGING with test users + mock data + RBAC roles.
#
# Purpose:  Zero-touch dev data so task.local.nself.org (and staging) are usable
#           immediately: known logins + sample lists/todos + one user per role.
# Users:    owner@/admin@/mod@/dev@/support@/user@/demo@/test@ nself.org — all pw "password".
# RBAC:     Roles + permissions seeded (all envs). Each test user gets matching role.
# Mock data: lists (Today/Work/Personal/Shopping) + todos for user@ and demo@
#            (only if that user has no todos yet — idempotent).
# Usage:    ./scripts/seed-dev.sh    (auto-run by `make up` in dev; safe to re-run)
# Guard:    refuses unless BASE_DOMAIN is local.nself.org / localhost / staging.* —
#           production is NEVER seeded by this script.
set -euo pipefail
cd "$(dirname "$0")/.."

BASE_DOMAIN="$(grep -h '^BASE_DOMAIN=' .env.dev .env 2>/dev/null | tail -1 | cut -d= -f2- || echo "")"
case "$BASE_DOMAIN" in
  *local.nself.org*|*localhost*|*staging.nself.org*)
    : ;;
  *)
    echo "REFUSING: BASE_DOMAIN='$BASE_DOMAIN' is not local/staging — dev seed only." >&2
    exit 1 ;;
esac

AUTH_URL="${AUTH_URL:-http://localhost:4000}"
PG_CONTAINER="${PG_CONTAINER:-${NSELF_PROJECT_NAME:-ntask}_postgres}"
docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER" || PG_CONTAINER="backend_postgres"
PG_DB="${PG_DB:-ntask}"
PW="password"

# ============================================================================
# 1. SEED ROLES + PERMISSIONS (all envs via shared seed SQL)
# ============================================================================
echo "→ Seeding roles + permissions..."
# Only run if migration 023 has been applied (public.roles exists)
ROLES_EXIST=$(docker exec -i "$PG_CONTAINER" psql -U postgres -d "$PG_DB" -tAq \
  -c "SELECT to_regclass('public.roles');" 2>/dev/null || echo "")
ROLES_EXIST="${ROLES_EXIST// /}"

if [ "$ROLES_EXIST" != "" ] && [ "$ROLES_EXIST" != "null" ]; then
  docker exec -i "$PG_CONTAINER" psql -U postgres -d "$PG_DB" -q \
    < postgres/seed/001_roles_permissions.sql
  echo "  roles/permissions seeded."
else
  echo "  SKIP: public.roles not found — run db-migrate.sh first to apply migration 023."
fi

# ============================================================================
# 2. SEED TEST USERS (one per role + existing demo@/test@)
# ============================================================================
# Role-specific users get their matching role assigned.
# demo@ and test@ keep the default 'user' role.
declare -A ROLE_USERS
ROLE_USERS=(
  ["owner"]="owner@nself.org"
  ["admin"]="admin@nself.org"
  ["mod"]="mod@nself.org"
  ["dev"]="dev@nself.org"
  ["support"]="support@nself.org"
  ["user"]="user@nself.org"
)
EXTRA_USERS=(demo@nself.org test@nself.org)
ALL_USERS=("${ROLE_USERS[@]}" "${EXTRA_USERS[@]}")

echo "→ Seeding users via $AUTH_URL"
for e in "${ALL_USERS[@]}"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$AUTH_URL/signup/email-password" \
    -H 'content-type: application/json' \
    -d "{\"email\":\"$e\",\"password\":\"$PW\"}" || echo 000)
  case "$code" in
    200|201) echo "  + created $e" ;;
    409|400|422) echo "  = exists  $e" ;;
    *) echo "  ! $e -> HTTP $code" ;;
  esac
done

# ============================================================================
# 3. VERIFY + ASSIGN ROLES + SEED MOCK DATA
# ============================================================================
echo "→ Verifying emails, assigning roles, seeding mock data (idempotent)"
docker exec -i "$PG_CONTAINER" psql -U postgres -d "$PG_DB" -q <<'SQL' 2>&1 | sed 's/^/  /'

-- Mark all @nself.org emails as verified
UPDATE auth.users SET email_verified = true, disabled = false
WHERE email LIKE '%@nself.org';

-- Assign role-specific roles via public.user_roles (trigger syncs to auth.user_roles).
-- Only runs if migration 023 is applied.
DO $roles$
DECLARE
  v_user_id UUID;
  v_role_key TEXT;
  v_role_id  UUID;
  v_email    TEXT;
BEGIN
  -- Skip if public.roles table doesn't exist yet
  IF to_regclass('public.roles') IS NULL THEN
    RAISE NOTICE 'public.roles not found — skipping role assignment (run migration 023 first).';
    RETURN;
  END IF;

  -- Assign matching role to each role-keyed test user
  FOR v_role_key, v_email IN
    SELECT * FROM (VALUES
      ('owner',   'owner@nself.org'),
      ('admin',   'admin@nself.org'),
      ('mod',     'mod@nself.org'),
      ('dev',     'dev@nself.org'),
      ('support', 'support@nself.org')
    ) AS t(role_key, email)
  LOOP
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
    SELECT id INTO v_role_id  FROM public.roles WHERE key = v_role_key;
    IF v_user_id IS NOT NULL AND v_role_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id)
        VALUES (v_user_id, v_role_id)
        ON CONFLICT DO NOTHING;
      -- For owner: set default_role (trigger handles this, but be explicit)
      IF v_role_key = 'owner' THEN
        UPDATE auth.users SET default_role = 'owner' WHERE id = v_user_id;
      END IF;
    END IF;
  END LOOP;

  -- Every remaining seeded user (user@, demo@, demo@ntask.local, test@, and
  -- any other future account) gets an EXPLICIT public.user_roles row for
  -- 'user' if they have no role row at all yet. hasura-auth already grants
  -- 'user' implicitly via auth.user_roles at signup, but public.user_roles
  -- (our app-side RBAC source of truth) had nothing to show for them.
  -- Matches postgres/migrations/024_rbac_backfill.sql section 2.
  INSERT INTO public.user_roles (user_id, role_id)
  SELECT u.id, r.id
  FROM public.users u
  JOIN public.roles r ON r.key = 'user'
  WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
  ON CONFLICT (user_id, role_id) DO NOTHING;
END
$roles$;

-- Seed mock task data for user@ and demo@ (idempotent: skip if todos exist)
DO $seed$
DECLARE uid uuid; work_id uuid; personal_id uuid; today_id uuid;
BEGIN
  FOR uid IN SELECT id FROM auth.users
             WHERE email IN ('user@nself.org','demo@nself.org') LOOP
    IF NOT EXISTS (SELECT 1 FROM np_todos WHERE user_id = uid) THEN
      INSERT INTO np_lists (user_id,title,color,icon,position,is_default) VALUES
        (uid,'Today','#6366f1','sun',0,true) RETURNING id INTO today_id;
      INSERT INTO np_lists (user_id,title,color,icon,position) VALUES
        (uid,'Work','#ef4444','briefcase',1) RETURNING id INTO work_id;
      INSERT INTO np_lists (user_id,title,color,icon,position) VALUES
        (uid,'Personal','#22c55e','user',2) RETURNING id INTO personal_id;
      INSERT INTO np_lists (user_id,title,color,icon,position) VALUES
        (uid,'Shopping','#f59e0b','cart',3);
      INSERT INTO np_todos (user_id,list_id,title,completed,completed_at,priority,position) VALUES
        (uid,work_id,'Finish Q3 roadmap',false,NULL,'high',0),
        (uid,work_id,'Review pull requests',false,NULL,'medium',1),
        (uid,personal_id,'Book dentist',true,now(),'none',0),
        (uid,personal_id,'Plan weekend trip',false,NULL,'low',1),
        (uid,today_id,'Try ɳTask ✨',false,NULL,'medium',0);
    END IF;
  END LOOP;
END
$seed$;

-- Verification summary
SELECT
  u.email,
  u.default_role,
  (SELECT string_agg(r.role, ', ' ORDER BY r.role)
   FROM auth.user_roles r WHERE r.user_id = u.id) AS auth_roles,
  (SELECT count(*) FROM np_lists  l WHERE l.user_id = u.id) AS lists,
  (SELECT count(*) FROM np_todos  t WHERE t.user_id = u.id) AS todos
FROM auth.users u
WHERE u.email LIKE '%@nself.org'
ORDER BY u.email;
SQL

echo "→ Done. Users (password: $PW):"
for e in "${ALL_USERS[@]}"; do echo "  $e"; done
echo "  Log in at https://${BASE_DOMAIN}"
