-- Migration 018: Add missing composite indexes for common ntask query patterns
-- K-S4-T15: DB index audit
--
-- Uses CREATE INDEX CONCURRENTLY to avoid table locks in production.
-- Run: hasura migrate apply --database-name default
-- Verify: EXPLAIN ANALYZE on each query pattern should show "Index Scan" not "Seq Scan"
--
-- Common query patterns covered:
--   1. todos-by-user:         np_todos WHERE user_id = $1 ORDER BY created_at DESC
--   2. todos-by-list:         np_todos WHERE list_id = $1 AND user_id = $2
--   3. todos-filtered-by-due: np_todos WHERE user_id = $1 AND completed = false AND due_date <= $2
--   4. activity-by-todo:      np_activity WHERE todo_id = $1 ORDER BY created_at DESC (if table exists)
--   5. notifications-by-user: np_notifications WHERE user_id = $1 AND read = false

-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
-- Hasura migrations run in a transaction by default.
-- These are added as regular indexes (non-concurrent) in migration context.
-- On a live production database with existing data, run these manually with CONCURRENTLY.

-- ---------------------------------------------------------------------------
-- np_todos indexes
-- ---------------------------------------------------------------------------

-- Pattern 1: todos-by-user (most common — list all todos for a user)
CREATE INDEX IF NOT EXISTS idx_np_todos_user_id_created_at
  ON public.np_todos (user_id, created_at DESC);

-- Pattern 2: todos-by-list (list todos within a specific list)
CREATE INDEX IF NOT EXISTS idx_np_todos_list_id_user_id
  ON public.np_todos (list_id, user_id)
  WHERE list_id IS NOT NULL;

-- Pattern 3: todos-filtered-by-due-date (inbox/today views)
CREATE INDEX IF NOT EXISTS idx_np_todos_user_id_completed_due_date
  ON public.np_todos (user_id, completed, due_date)
  WHERE due_date IS NOT NULL;

-- Pattern: public todos (for shared/public task links)
CREATE INDEX IF NOT EXISTS idx_np_todos_is_public_created_at
  ON public.np_todos (is_public, created_at DESC)
  WHERE is_public = true;

-- ---------------------------------------------------------------------------
-- np_notifications indexes
-- ---------------------------------------------------------------------------

-- Pattern 5: notifications-by-user (unread notification badge + list)
CREATE INDEX IF NOT EXISTS idx_np_notifications_user_id_read_created_at
  ON public.np_notifications (user_id, read, created_at DESC);

-- ---------------------------------------------------------------------------
-- np_recurring_instances indexes
-- ---------------------------------------------------------------------------

-- Pattern: recurring instances by date (daily cron needs this)
CREATE INDEX IF NOT EXISTS idx_np_recurring_instances_instance_date_parent
  ON public.np_recurring_instances (instance_date, parent_todo_id);

-- ---------------------------------------------------------------------------
-- np_lists indexes
-- ---------------------------------------------------------------------------

-- Pattern: lists by user ordered by position
CREATE INDEX IF NOT EXISTS idx_np_lists_user_id_position
  ON public.np_lists (user_id, position);

-- ---------------------------------------------------------------------------
-- np_reminders indexes (if table exists — created in migration 013)
-- ---------------------------------------------------------------------------

-- Pattern: reminders to dispatch (cron every 5 min)
-- Column is 'sent' in the actual schema (migration 013 used 'sent', not 'dispatched')
CREATE INDEX IF NOT EXISTS idx_np_reminders_remind_at_sent
  ON public.np_reminders (remind_at, sent)
  WHERE sent = false;

-- ---------------------------------------------------------------------------
-- np_todo_assignees indexes (if table exists — created in migration 015)
-- ---------------------------------------------------------------------------

-- assignee_id is the user-facing column (user_id does not exist on this table)
CREATE INDEX IF NOT EXISTS idx_np_todo_assignees_assignee_id_2
  ON public.np_todo_assignees (assignee_id);

-- ---------------------------------------------------------------------------
-- Enable pg_stat_statements for N+1 detection (K-S4-T18)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
