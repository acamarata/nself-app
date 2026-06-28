-- Migration 014: Add np_recurring_rules table (structured RRULE)
-- Replaces np_todos.recurrence_rule TEXT (column kept deprecated).
-- Typed columns allow DB-level validation and efficient cron dispatch queries.
-- Constraint: until_date and count_limit are mutually exclusive.

-- PostgreSQL does not support CREATE TYPE IF NOT EXISTS; guard with a DO-block.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'rrule_frequency'
  ) THEN
    EXECUTE 'CREATE TYPE public.rrule_frequency AS ENUM (''daily'', ''weekly'', ''monthly'', ''yearly'')';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.np_recurring_rules (
  id                UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id           UUID              NOT NULL UNIQUE REFERENCES public.np_todos(id) ON DELETE CASCADE,
  frequency         public.rrule_frequency NOT NULL,
  interval_count    INTEGER           NOT NULL DEFAULT 1 CHECK (interval_count > 0),
  by_day            TEXT[],
  by_month_day      INTEGER[],
  by_month          INTEGER[],
  until_date        DATE,
  count_limit       INTEGER           CHECK (count_limit > 0),
  rrule             TEXT,
  start_date        DATE,
  end_date          DATE,
  source_account_id TEXT              NOT NULL DEFAULT 'primary',
  created_at        TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ       NOT NULL DEFAULT now(),
  CONSTRAINT chk_until_or_count CHECK (
    NOT (until_date IS NOT NULL AND count_limit IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_np_recurring_rules_todo_id        ON public.np_recurring_rules(todo_id);
CREATE INDEX IF NOT EXISTS idx_np_recurring_rules_source_account ON public.np_recurring_rules(source_account_id);

DROP TRIGGER IF EXISTS set_np_recurring_rules_updated_at ON public.np_recurring_rules;
CREATE TRIGGER set_np_recurring_rules_updated_at
  BEFORE UPDATE ON public.np_recurring_rules
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.np_recurring_rules ENABLE ROW LEVEL SECURITY;

-- SELECT: todo owner OR list member (chained via np_todos)
DROP POLICY IF EXISTS recurring_rules_select_policy ON public.np_recurring_rules;
CREATE POLICY recurring_rules_select_policy ON public.np_recurring_rules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.np_todos t
      WHERE t.id = todo_id
        AND (
          t.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.np_list_shares ls
            WHERE ls.list_id = t.list_id
              AND ls.shared_with_user_id = auth.uid()
              AND ls.accepted_at IS NOT NULL
          )
        )
    )
  );

-- INSERT/UPDATE/DELETE: todo owner only
DROP POLICY IF EXISTS recurring_rules_insert_policy ON public.np_recurring_rules;
CREATE POLICY recurring_rules_insert_policy ON public.np_recurring_rules
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.np_todos t
      WHERE t.id = todo_id AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS recurring_rules_update_policy ON public.np_recurring_rules;
CREATE POLICY recurring_rules_update_policy ON public.np_recurring_rules
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.np_todos t
      WHERE t.id = todo_id AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS recurring_rules_delete_policy ON public.np_recurring_rules;
CREATE POLICY recurring_rules_delete_policy ON public.np_recurring_rules
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.np_todos t
      WHERE t.id = todo_id AND t.user_id = auth.uid()
    )
  );
