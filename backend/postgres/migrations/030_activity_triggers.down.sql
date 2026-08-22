DROP TRIGGER IF EXISTS np_todos_activity_ins ON public.np_todos;
DROP TRIGGER IF EXISTS np_todos_activity_upd ON public.np_todos;
DROP TRIGGER IF EXISTS np_todos_activity_del ON public.np_todos;
DROP FUNCTION IF EXISTS public.np_log_todo_activity();
