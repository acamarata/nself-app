/**
 * Purpose: Cover applyFilters — the filter/sort logic behind saved views.
 *
 * np_saved_views.filters is a jsonb blob written by the web client, so this
 * code receives values it did not produce and cannot assume are well-formed.
 * The interesting cases are therefore the malformed and missing ones.
 * SPORT: P5-C-mobile — saved views.
 */
import { applyFilters } from '../useSavedViews';
import type { FilterParams } from '@nself/ntask-core';
import type { SmartViewTask } from '../../lib/smartViewsOps';

const task = (over: Partial<SmartViewTask>): SmartViewTask => ({
  id: 'x', title: 'Task', completed: false, priority: 'none', due_date: null, list_id: 'l1', ...over,
});

const TASKS: SmartViewTask[] = [
  task({ id: 'a', title: 'Beta', completed: false, priority: 'high', due_date: '2026-03-02T00:00:00Z' }),
  task({ id: 'b', title: 'Alpha', completed: true, priority: 'low', due_date: '2026-03-01T00:00:00Z' }),
  task({ id: 'c', title: 'Gamma', completed: false, priority: 'high', due_date: null }),
];

const filters = (over: Partial<FilterParams> = {}): FilterParams => ({
  status: 'all', priority: '', tagIds: [], sortField: 'due_date', sortDir: 'asc', ...over,
});

describe('applyFilters', () => {
  it('returns the list untouched when there are no filters', () => {
    expect(applyFilters(TASKS, null)).toBe(TASKS);
    expect(applyFilters(TASKS, undefined)).toBe(TASKS);
  });

  it('filters to active tasks', () => {
    const out = applyFilters(TASKS, filters({ status: 'active' }));
    expect(out.map((t) => t.id).sort()).toEqual(['a', 'c']);
  });

  it('filters to completed tasks', () => {
    const out = applyFilters(TASKS, filters({ status: 'completed' }));
    expect(out.map((t) => t.id)).toEqual(['b']);
  });

  it('filters by priority', () => {
    const out = applyFilters(TASKS, filters({ priority: 'high' }));
    expect(out.map((t) => t.id).sort()).toEqual(['a', 'c']);
  });

  it('treats a priority that no longer exists as matching nothing', () => {
    // Not the same as ignoring it: a view saved against a deleted priority
    // should show an empty result, not the unfiltered list.
    expect(applyFilters(TASKS, filters({ priority: 'nonexistent' }))).toHaveLength(0);
  });

  it('treats priority "all" as no priority filter', () => {
    expect(applyFilters(TASKS, filters({ priority: 'all' }))).toHaveLength(3);
  });

  it('sorts by due date ascending, undated last', () => {
    const out = applyFilters(TASKS, filters({ sortField: 'due_date', sortDir: 'asc' }));
    expect(out.map((t) => t.id)).toEqual(['b', 'a', 'c']);
  });

  it('keeps undated tasks last even when sorting descending', () => {
    // An undated task is unscheduled, not "earliest" — flipping direction must
    // not float it to the top.
    const out = applyFilters(TASKS, filters({ sortField: 'due_date', sortDir: 'desc' }));
    expect(out[out.length - 1]!.id).toBe('c');
  });

  it('sorts by title', () => {
    const out = applyFilters(TASKS, filters({ sortField: 'title', sortDir: 'asc' }));
    expect(out.map((t) => t.title)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('falls back to due-date order for an unknown sort field', () => {
    const out = applyFilters(TASKS, filters({ sortField: 'not_a_column' }));
    expect(out.map((t) => t.id)).toEqual(['b', 'a', 'c']);
  });

  it('does not mutate the input array', () => {
    const input = [...TASKS];
    applyFilters(input, filters({ sortField: 'title' }));
    expect(input.map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });
});
