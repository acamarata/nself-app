/**
 * Purpose: Data + bucketing hook for the Today / Upcoming / Overdue smart view.
 * Inputs: urql query GET_MY_OPEN_TASKS (all incomplete, due-dated todos for the caller).
 * Outputs: { today, upcoming, overdue, loading, error, refetch } — three pre-sorted buckets.
 * Constraints:
 *   - Bucketing is local-time based on the device clock, matching how due dates are
 *     displayed elsewhere in the app (TaskCard renders due_date verbatim, no TZ shift).
 *   - "Today" = due_date falls on the current calendar day.
 *   - "Overdue" = due_date is strictly before the start of today and still incomplete.
 *   - "Upcoming" = due_date is after today (any future day).
 * SPORT: mobile/web parity delta — Smart Views (Today/Overdue) small mobile addition
 */

import { useQuery } from 'urql';
import { GET_MY_OPEN_TASKS, type MyOpenTasksData, type SmartViewTask } from '../lib/smartViewsOps';

export type SmartViewBucket = 'today' | 'upcoming' | 'overdue';

interface UseSmartViewsResult {
  today: SmartViewTask[];
  upcoming: SmartViewTask[];
  overdue: SmartViewTask[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/** Start-of-day boundary (local time) for the given date, as a millisecond timestamp. */
function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Classify a single due_date ISO string against "today" into a smart-view bucket. */
export function classifyDueDate(dueDateIso: string, now: Date = new Date()): SmartViewBucket {
  const due = new Date(dueDateIso);
  const todayStart = startOfDay(now);
  const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;
  const dueTime = due.getTime();

  if (dueTime < todayStart) return 'overdue';
  if (dueTime < tomorrowStart) return 'today';
  return 'upcoming';
}

/**
 * Fetch the caller's open (incomplete) due-dated todos across all lists and bucket
 * them into Today / Upcoming / Overdue. Each bucket stays sorted soonest-first.
 */
export function useSmartViews(): UseSmartViewsResult {
  const [result, reexecuteQuery] = useQuery<MyOpenTasksData>({
    query: GET_MY_OPEN_TASKS,
    requestPolicy: 'cache-and-network',
  });

  const tasks = result.data?.np_todos ?? [];
  const buckets: Record<SmartViewBucket, SmartViewTask[]> = { today: [], upcoming: [], overdue: [] };

  for (const task of tasks) {
    if (!task.due_date) continue;
    buckets[classifyDueDate(task.due_date)].push(task);
  }

  return {
    today: buckets.today,
    upcoming: buckets.upcoming,
    overdue: buckets.overdue,
    loading: result.fetching,
    error: result.error?.message ?? null,
    refetch: () => reexecuteQuery({ requestPolicy: 'network-only' }),
  };
}
