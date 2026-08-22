-- Populate np_activity automatically on todo changes.
--
-- WHY A POSTGRES TRIGGER RATHER THAN A HASURA EVENT TRIGGER
-- np_activity is an in-database audit log: the source row, the actor and the
-- destination table all live in this database. A Hasura event trigger would
-- POST to the functions service, which then writes back here — a network hop
-- that can fail, retry, duplicate, or silently stop when the handler is down.
-- Event triggers are the right tool for EXTERNAL side effects (send an email,
-- call an API); they are the wrong tool for this. A statement-level trigger
-- cannot miss an event and needs no webhook secret or handler to maintain.
--
-- ACTOR
-- auth.uid() reads x-hasura-user-id from the Hasura session (see
-- init/03-auth-helpers.sql) and returns NULL outside a Hasura session, e.g. a
-- direct psql connection or a migration. np_activity.actor_id is NOT NULL, so
-- rows with no identifiable actor are skipped rather than attributed to
-- someone. That is deliberate: a wrong actor in an audit log is worse than an
-- absent entry.
--
-- ACTIONS: created | updated | completed
-- 'completed' is emitted instead of 'updated' when the change is the
-- completion flag flipping true, because that is the event users care about.
--
-- 'deleted' is deliberately NOT logged. np_activity.todo_id is
-- REFERENCES np_todos(id) ON DELETE CASCADE, so any row written for a deletion
-- is removed by that cascade in the same statement — verified: a create →
-- rename → complete → delete sequence left zero rows, because the delete took
-- the whole history with it. The feed's RLS also joins np_todos, so activity
-- for a deleted todo would be unreachable even if it survived. Deletion
-- auditing belongs in an account-level log with no FK to the deleted row, not
-- in a per-todo feed.
--
-- 'assigned' is intentionally not emitted here — assignment lives on a
-- different table and belongs with that feature (P5 T-07).

CREATE OR REPLACE FUNCTION public.np_log_todo_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor  UUID := auth.uid();
  v_action TEXT;
  v_meta   JSONB := '{}'::jsonb;
BEGIN
  -- No identifiable actor (admin psql, migration, seed): record nothing.
  IF v_actor IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_meta := jsonb_build_object('title', NEW.title);

  ELSE
    -- Completion is the interesting transition; report it as its own action.
    IF COALESCE(NEW.completed, false) IS DISTINCT FROM COALESCE(OLD.completed, false) THEN
      v_action := CASE WHEN NEW.completed THEN 'completed' ELSE 'updated' END;
      v_meta := jsonb_build_object('field', 'completed',
                                   'old', OLD.completed, 'new', NEW.completed);
    ELSIF NEW.title IS DISTINCT FROM OLD.title THEN
      v_action := 'updated';
      v_meta := jsonb_build_object('field', 'title', 'old', OLD.title, 'new', NEW.title);
    ELSIF NEW.priority IS DISTINCT FROM OLD.priority THEN
      v_action := 'updated';
      v_meta := jsonb_build_object('field', 'priority', 'old', OLD.priority, 'new', NEW.priority);
    ELSIF NEW.due_date IS DISTINCT FROM OLD.due_date THEN
      v_action := 'updated';
      v_meta := jsonb_build_object('field', 'due_date', 'old', OLD.due_date, 'new', NEW.due_date);
    ELSE
      -- Touch-only update (updated_at, position reshuffle): not worth a row.
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.np_activity (todo_id, actor_id, action, metadata)
  VALUES (COALESCE(NEW.id, OLD.id), v_actor, v_action, v_meta);

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.np_log_todo_activity() IS
  'Writes np_activity rows for np_todos changes. Skips when auth.uid() is NULL so an audit entry is never attributed to the wrong actor.';

DROP TRIGGER IF EXISTS np_todos_activity_ins ON public.np_todos;
DROP TRIGGER IF EXISTS np_todos_activity_upd ON public.np_todos;
DROP TRIGGER IF EXISTS np_todos_activity_del ON public.np_todos;

CREATE TRIGGER np_todos_activity_ins AFTER INSERT ON public.np_todos
  FOR EACH ROW EXECUTE FUNCTION public.np_log_todo_activity();

CREATE TRIGGER np_todos_activity_upd AFTER UPDATE ON public.np_todos
  FOR EACH ROW EXECUTE FUNCTION public.np_log_todo_activity();
