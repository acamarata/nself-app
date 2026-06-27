-- Migration 008: Server-side recurring task instance creation via pg_cron
-- T-2423: Moves recurring task reset logic from client-side (recurring-reset.ts)
-- to a server-side scheduled event that runs daily at 3:00 AM UTC.
--
-- Requires pg_cron extension (available in PostgreSQL 14+ with the pg_cron package).
-- nself installs pg_cron automatically when using the cron plugin, or it can be
-- enabled manually: `CREATE EXTENSION IF NOT EXISTS pg_cron;`

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Function: create recurring task instances for today
-- Evaluates recurrence_rule patterns (daily, weekly:mon,wed,fri, monthly:15)
-- and inserts into np_recurring_instances if no instance exists for today.
CREATE OR REPLACE FUNCTION public.create_recurring_instances()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  rec RECORD;
  today DATE := CURRENT_DATE;
  today_dow TEXT;
  today_dom INT;
  last_dom INT;
  pattern TEXT;
  rule_days TEXT[];
  rule_day_num INT;
  should_create BOOLEAN;
BEGIN
  -- Day-of-week name (lowercase 3-letter abbreviation matching the client format)
  today_dow := LOWER(LEFT(TO_CHAR(today, 'Dy'), 3));
  today_dom := EXTRACT(DAY FROM today)::INT;
  last_dom := EXTRACT(DAY FROM (DATE_TRUNC('month', today) + INTERVAL '1 month' - INTERVAL '1 day'))::INT;

  FOR rec IN
    SELECT id, recurrence_rule
    FROM public.np_todos
    WHERE recurrence_rule IS NOT NULL
      AND recurrence_rule != ''
  LOOP
    should_create := FALSE;
    pattern := SPLIT_PART(rec.recurrence_rule, ':', 1);

    IF pattern = 'daily' THEN
      should_create := TRUE;

    ELSIF pattern = 'weekly' THEN
      -- Format: "weekly:mon,wed,fri"
      rule_days := STRING_TO_ARRAY(SPLIT_PART(rec.recurrence_rule, ':', 2), ',');
      -- Trim whitespace from each element
      FOR i IN 1..ARRAY_LENGTH(rule_days, 1) LOOP
        rule_days[i] := LOWER(TRIM(rule_days[i]));
      END LOOP;
      IF today_dow = ANY(rule_days) THEN
        should_create := TRUE;
      END IF;

    ELSIF pattern = 'monthly' THEN
      -- Format: "monthly:15"
      rule_day_num := SPLIT_PART(rec.recurrence_rule, ':', 2)::INT;
      -- If target day exceeds month length, trigger on last day
      IF rule_day_num > last_dom THEN
        should_create := (today_dom = last_dom);
      ELSE
        should_create := (today_dom = rule_day_num);
      END IF;
    END IF;

    IF should_create THEN
      -- Only insert if no instance exists for this todo on this date
      INSERT INTO public.np_recurring_instances (parent_todo_id, instance_date, completed, completed_at)
      VALUES (rec.id, today, FALSE, NULL)
      ON CONFLICT (parent_todo_id, instance_date) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- Schedule the function to run daily at 3:00 AM UTC
SELECT cron.schedule(
  'ntask-create-recurring-instances',
  '0 3 * * *',
  'SELECT public.create_recurring_instances()'
);
