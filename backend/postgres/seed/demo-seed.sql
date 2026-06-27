-- demo-seed.sql — example ɳTask data for self-hosted evaluation
-- Idempotent: all inserts use ON CONFLICT DO NOTHING.
-- Run via: DEMO_SEED=1 make demo-seed
--
-- Tables used (actual np_* schema from init.sql + migrations):
--   np_lists  — task list containers (user_id, title, color, icon)
--   np_todos  — tasks (user_id, title, description, completed, list_id via migration)
--   np_tags   — tag definitions (migration 012)
--   np_todo_tags — task-tag junction (migration 012)
--
-- Demo user is created directly in auth.users using pgcrypto (loaded in 01-extensions.sql).
-- On first login via the app, use: demo@example.com / DemoPass123!
-- IMPORTANT: Remove or rotate this account before using in production.

BEGIN;

-- ---------------------------------------------------------------------------
-- Demo user (direct insert — bypasses email verification for local eval)
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email, display_name, password_hash, email_verified, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'demo@example.com',
  'Demo User',
  crypt('DemoPass123!', gen_salt('bf')),
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Profile row (created automatically by on_auth_user_created trigger, but insert
-- explicitly to guarantee it exists when running demo-seed standalone)
INSERT INTO public.np_profiles (id, email, display_name, source_account_id)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'demo@example.com',
  'Demo User',
  'primary'
) ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3 demo lists
-- ---------------------------------------------------------------------------
INSERT INTO public.np_lists (id, user_id, title, description, color, icon, position, source_account_id)
VALUES
  ('10000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000001',
   'Work',
   'Work tasks and follow-ups',
   '#3B82F6', 'briefcase', 0, 'primary'),

  ('10000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000001',
   'Personal',
   'Personal errands and goals',
   '#10B981', 'home', 1, 'primary'),

  ('10000000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000001',
   'Learning',
   'Books, courses, and skills',
   '#8B5CF6', 'book', 2, 'primary')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2 demo tags
-- ---------------------------------------------------------------------------
INSERT INTO public.np_tags (id, user_id, name, color, source_account_id)
VALUES
  ('20000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000001',
   'urgent', '#EF4444', 'primary'),

  ('20000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000001',
   'research', '#6366F1', 'primary')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 10 demo todos spread across lists and statuses
-- (np_todos: user_id, title, description, completed, source_account_id)
-- list_id added by migration 006_list_groups or similar — include only if column exists
-- ---------------------------------------------------------------------------

-- Work todos
INSERT INTO public.np_todos (id, user_id, title, description, completed, source_account_id)
VALUES
  ('30000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000001',
   'Review Q2 reports',
   'Check revenue and churn metrics in the dashboard',
   false, 'primary'),

  ('30000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000001',
   'Send onboarding email to new users',
   NULL,
   false, 'primary'),

  ('30000000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000001',
   'Update API docs for webhook endpoints',
   'Cover the new webhook endpoints added in v1.1.4',
   false, 'primary'),

  ('30000000-0000-0000-0000-000000000004',
   '00000000-0000-0000-0000-000000000001',
   'Deploy v1.1.4 to staging',
   NULL,
   true, 'primary'),

-- Personal todos
  ('30000000-0000-0000-0000-000000000005',
   '00000000-0000-0000-0000-000000000001',
   'Buy groceries',
   'Milk, eggs, coffee beans',
   false, 'primary'),

  ('30000000-0000-0000-0000-000000000006',
   '00000000-0000-0000-0000-000000000001',
   'Book dentist appointment',
   NULL,
   false, 'primary'),

  ('30000000-0000-0000-0000-000000000007',
   '00000000-0000-0000-0000-000000000001',
   'Call insurance provider',
   'Ask about the new plan options',
   false, 'primary'),

-- Learning todos
  ('30000000-0000-0000-0000-000000000008',
   '00000000-0000-0000-0000-000000000001',
   'Read "The Phoenix Project"',
   'Currently on chapter 12',
   false, 'primary'),

  ('30000000-0000-0000-0000-000000000009',
   '00000000-0000-0000-0000-000000000001',
   'Complete Go tutorial series',
   NULL,
   false, 'primary'),

  ('30000000-0000-0000-0000-000000000010',
   '00000000-0000-0000-0000-000000000001',
   'Set up home lab server',
   'Install ntask, nchat, nself CLI',
   true, 'primary')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Tag assignments
-- ---------------------------------------------------------------------------
INSERT INTO public.np_todo_tags (todo_id, tag_id, source_account_id)
VALUES
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'primary'),
  ('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001', 'primary'),
  ('30000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000002', 'primary')
ON CONFLICT DO NOTHING;

COMMIT;

-- Verification query (run manually to confirm):
-- SELECT count(*) FROM public.np_todos;   -- expect 10
-- SELECT count(*) FROM public.np_lists;   -- expect 3
-- SELECT count(*) FROM public.np_tags;    -- expect 2
