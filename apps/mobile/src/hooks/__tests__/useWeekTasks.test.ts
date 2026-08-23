/**
 * Purpose: Tests for useWeekTasks — Sunday-start week math, local-day grouping,
 *          and the flattened task list reused from the smart-view buckets.
 * Inputs: mocked urql useQuery (exercises the real useSmartViews under the hook).
 * Outputs: jest assertions on the pure helpers and the hook result.
 * Constraints: jest-expo preset; renderHook from @testing-library/react-native.
 * SPORT: MB-4 calendar view on mobile (web parity with WeekStrip scope)
 */

import { renderHook } from '@testing-library/react-native';
import { useQuery } from 'urql';
import {
  addDays, groupTasksByWeekDay, isoDayOf, startOfWeek, useWeekTasks,
} from '../useWeekTasks';
import type { SmartViewTask } from '../../lib/smartViewsOps';

jest.mock('urql', () => ({
  useQuery: jest.fn(),
  gql: (s: TemplateStringsArray) => s[0],
}));

const mockedUseQuery = jest.mocked(useQuery);

/** ISO string for a local-time date at the given hour (due_date wire format). */
function localIso(date: Date, hour = 9): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0, 0);
  return d.toISOString();
}

function makeTask(id: string, due: Date, listId = 'l1'): SmartViewTask {
  return { id, title: `Task ${id}`, completed: false, priority: 'none', due_date: localIso(due), list_id: listId };
}

/** Relative-to-now local date (keeps bucket classification stable at any run time). */
function inDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('pure helpers', () => {
  it('startOfWeek backs up to Sunday (mirroring the web WeekStrip base)', () => {
    const wednesday = new Date(2026, 7, 26); // 2026-08-26 is a Wednesday
    const sunday = startOfWeek(wednesday);
    expect(sunday.getDay()).toBe(0);
    expect(isoDayOf(sunday)).toBe('2026-08-23');
  });

  it('isoDayOf uses the local calendar day, not UTC', () => {
    expect(isoDayOf(new Date(2026, 7, 26, 23, 59))).toBe('2026-08-26');
  });

  it('addDays crosses month boundaries in local time', () => {
    const nextDay = addDays(new Date(2026, 7, 31), 1);
    expect(isoDayOf(nextDay)).toBe('2026-09-01');
  });
});

describe('groupTasksByWeekDay', () => {
  const weekStart = new Date(2026, 7, 23); // Sunday 2026-08-23

  it('groups tasks into their due day and excludes other weeks', () => {
    const mondayTask = makeTask('m1', new Date(2026, 7, 24));
    const mondayTaskLate = makeTask('m2', new Date(2026, 7, 24, 22));
    const fridayTask = makeTask('f1', new Date(2026, 7, 28));
    const nextWeekTask = makeTask('n1', new Date(2026, 8, 1));
    const noDueTask: SmartViewTask = { ...makeTask('x1', new Date()), due_date: null };

    const groups = groupTasksByWeekDay(
      [nextWeekTask, fridayTask, noDueTask, mondayTask, mondayTaskLate],
      weekStart,
    );

    expect(groups).toHaveLength(7);
    expect(groups[0]!.isoDay).toBe('2026-08-23');
    expect(groups[1]!.tasks.map((t) => t.id)).toEqual(['m1', 'm2']);
    expect(groups[5]!.tasks.map((t) => t.id)).toEqual(['f1']);
    expect(groups[6]!.tasks).toEqual([]);
    const allIds = groups.flatMap((g) => g.tasks.map((t) => t.id));
    expect(allIds).not.toContain('n1');
    expect(allIds).not.toContain('x1');
  });
});

describe('useWeekTasks', () => {
  it('flattens the smart-view buckets into one task list', () => {
    mockedUseQuery.mockReturnValue([
      {
        data: {
          np_todos: [
            { id: '1', title: 'Overdue task', completed: false, priority: 'high', due_date: localIso(inDays(-2)), list_id: 'l1' },
            { id: '2', title: 'Today task', completed: false, priority: 'medium', due_date: localIso(inDays(0)), list_id: 'l1' },
            { id: '3', title: 'Upcoming task', completed: false, priority: 'low', due_date: localIso(inDays(3)), list_id: 'l2' },
            { id: '4', title: 'No due date', completed: false, priority: 'none', due_date: null, list_id: 'l2' },
          ],
        },
        fetching: false,
        error: undefined,
      },
      jest.fn(),
    ] as never);

    const { result } = renderHook(() => useWeekTasks());

    expect(result.current.tasks.map((t) => t.id)).toEqual(['1', '2', '3']);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('passes loading and error through from the shared query', () => {
    mockedUseQuery.mockReturnValue([
      { data: null, fetching: true, error: undefined },
      jest.fn(),
    ] as never);

    const loading = renderHook(() => useWeekTasks());
    expect(loading.result.current.loading).toBe(true);
    expect(loading.result.current.tasks).toEqual([]);

    mockedUseQuery.mockReturnValue([
      { data: null, fetching: false, error: { message: 'Network error' } },
      jest.fn(),
    ] as never);

    const errored = renderHook(() => useWeekTasks());
    expect(errored.result.current.error).toBe('Network error');
  });
});
