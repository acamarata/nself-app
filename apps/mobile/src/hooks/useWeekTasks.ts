/**
 * Purpose: Week-at-a-glance data for the mobile calendar — groups the caller's
 *          open, due-dated todos into the seven local-time days of a week.
 * Inputs: useSmartViews (the existing urql GET_MY_OPEN_TASKS hook — reused as-is).
 * Outputs: useWeekTasks() { tasks, loading, error, refetch } plus pure helpers
 *          (startOfWeek, addDays, isoDayOf, groupTasksByWeekDay, label formatters).
 * Constraints:
 *   - No second task query and no second source of truth: the hook flattens the
 *     smart-view buckets (overdue + today + upcoming = every open due-dated todo),
 *     so past weeks (overdue) and future weeks (upcoming) are both complete.
 *   - Day grouping is local-calendar-day based, matching classifyDueDate in
 *     useSmartViews (no timezone shifting of due_date).
 *   - Weeks start on Sunday, mirroring the web WeekStrip (date-fns startOfWeek
 *     default) so both surfaces slice the week identically.
 * SPORT: MB-4 calendar view on mobile (web parity with WeekStrip scope)
 */

import { useMemo } from 'react';
import { useSmartViews } from './useSmartViews';
import type { SmartViewTask } from '../lib/smartViewsOps';

export interface WeekDayGroup {
  /** Local midnight of the day. */
  date: Date;
  /** Local YYYY-MM-DD key, matching isoDayOf(). */
  isoDay: string;
  /** Tasks due this day, soonest-first (query order preserved). */
  tasks: SmartViewTask[];
}

export const WEEK_DAYS = 7;

/** Local YYYY-MM-DD for a date — deliberately not toISOString (UTC shift). */
export function isoDayOf(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** date + n calendar days in local time (constructs midnight to avoid DST drift). */
export function addDays(date: Date, days: number): Date {
  const shifted = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

/** Start (Sunday, local midnight) of the week containing date. */
export function startOfWeek(date: Date): Date {
  return addDays(date, -date.getDay());
}

/** Group tasks into the seven days of the week starting at weekStart. */
export function groupTasksByWeekDay(tasks: SmartViewTask[], weekStart: Date): WeekDayGroup[] {
  const groups: WeekDayGroup[] = [];
  for (let i = 0; i < WEEK_DAYS; i++) {
    const date = addDays(weekStart, i);
    groups.push({ date, isoDay: isoDayOf(date), tasks: [] });
  }
  const byIsoDay = new Map(groups.map((group) => [group.isoDay, group.tasks]));

  for (const task of tasks) {
    if (!task.due_date) continue;
    byIsoDay.get(isoDayOf(new Date(task.due_date)))?.push(task);
  }
  return groups;
}

/** "Sun 23" style label in the device locale; ISO day if Intl is unavailable. */
export function formatDayLabel(date: Date): string {
  try {
    return new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric' }).format(date);
  } catch {
    return isoDayOf(date);
  }
}

/** "Aug 23 - Aug 29" style range for the week starting at weekStart. */
export function formatWeekRange(weekStart: Date): string {
  const formatShort = (d: Date): string => {
    try {
      return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(d);
    } catch {
      return isoDayOf(d);
    }
  };
  return `${formatShort(weekStart)} - ${formatShort(addDays(weekStart, WEEK_DAYS - 1))}`;
}

interface UseWeekTasksResult {
  tasks: SmartViewTask[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * All of the caller's open, due-dated todos, flattened from the smart-view
 * buckets. Loading/error/refetch pass through from the shared query.
 */
export function useWeekTasks(): UseWeekTasksResult {
  const { today, upcoming, overdue, loading, error, refetch } = useSmartViews();
  const tasks = useMemo(
    () => [...overdue, ...today, ...upcoming],
    [overdue, today, upcoming],
  );
  return { tasks, loading, error, refetch };
}
