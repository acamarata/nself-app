-- Down migration 018: Remove composite indexes added in 018_add_missing_indexes.sql

DROP INDEX IF EXISTS idx_np_todos_user_id_created_at;
DROP INDEX IF EXISTS idx_np_todos_list_id_user_id;
DROP INDEX IF EXISTS idx_np_todos_user_id_completed_due_date;
DROP INDEX IF EXISTS idx_np_todos_is_public_created_at;
DROP INDEX IF EXISTS idx_np_notifications_user_id_read_created_at;
DROP INDEX IF EXISTS idx_np_recurring_instances_instance_date_parent;
DROP INDEX IF EXISTS idx_np_lists_user_id_position;
DROP INDEX IF EXISTS idx_np_reminders_remind_at_dispatched;
DROP INDEX IF EXISTS idx_np_todo_assignees_user_id;
