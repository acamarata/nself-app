/**
 * Purpose: Tests for useSmartViews — bucketing of open, due-dated todos into
 *          Today / Upcoming / Overdue, plus the classifyDueDate helper directly.
 * Inputs: mocked urql useQuery returning a fixed set of np_todos rows.
 * Outputs: jest assertions on bucket membership, ordering, and loading/error passthrough.
 * Constraints: Uses @testing-library/react-native renderHook; jest-expo preset; TS strict.
 * SPORT: mobile/web parity delta — Smart Views (Today/Overdue) small mobile addition
 */

import { renderHook } from '@testing-library/react-native';
import { useQuery } from 'urql';
import { useSmartViews, classifyDueDate } from '../useSmartViews';

jest.mock('urql', () => ({
  useQuery: jest.fn(),
  gql: (s: TemplateStringsArray) => s[0],
}));

const mockedUseQuery = jest.mocked(useQuery);

function iso(daysFromNow: number, hour = 9): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('classifyDueDate', () => {
  const now = new Date(2026, 6, 6, 12, 0, 0); // 2026-07-06 noon, fixed reference

  it('classifies a due date earlier today as today', () => {
    expect(classifyDueDate(new Date(2026, 6, 6, 8, 0, 0).toISOString(), now)).toBe('today');
  });

  it('classifies yesterday as overdue', () => {
    expect(classifyDueDate(new Date(2026, 6, 5, 23, 0, 0).toISOString(), now)).toBe('overdue');
  });

  it('classifies tomorrow as upcoming', () => {
    expect(classifyDueDate(new Date(2026, 6, 7, 0, 0, 0).toISOString(), now)).toBe('upcoming');
  });
});

describe('useSmartViews', () => {
  it('buckets tasks into today/overdue/upcoming and sorts within each bucket', () => {
    mockedUseQuery.mockReturnValue([
      {
        data: {
          np_todos: [
            { id: '1', title: 'Overdue task', completed: false, priority: 'high', due_date: iso(-2), list_id: 'l1' },
            { id: '2', title: 'Today task', completed: false, priority: 'medium', due_date: iso(0), list_id: 'l1' },
            { id: '3', title: 'Upcoming task', completed: false, priority: 'low', due_date: iso(3), list_id: 'l2' },
          ],
        },
        fetching: false,
        error: undefined,
      },
      jest.fn(),
    ] as never);

    const { result } = renderHook(() => useSmartViews());

    expect(result.current.today).toHaveLength(1);
    expect(result.current.today[0]?.id).toBe('2');
    expect(result.current.overdue).toHaveLength(1);
    expect(result.current.overdue[0]?.id).toBe('1');
    expect(result.current.upcoming).toHaveLength(1);
    expect(result.current.upcoming[0]?.id).toBe('3');
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('returns empty buckets when there is no data', () => {
    mockedUseQuery.mockReturnValue([
      { data: null, fetching: false, error: undefined },
      jest.fn(),
    ] as never);

    const { result } = renderHook(() => useSmartViews());

    expect(result.current.today).toEqual([]);
    expect(result.current.overdue).toEqual([]);
    expect(result.current.upcoming).toEqual([]);
  });

  it('surfaces the loading flag while fetching', () => {
    mockedUseQuery.mockReturnValue([
      { data: null, fetching: true, error: undefined },
      jest.fn(),
    ] as never);

    const { result } = renderHook(() => useSmartViews());

    expect(result.current.loading).toBe(true);
  });

  it('surfaces the error message when the query fails', () => {
    mockedUseQuery.mockReturnValue([
      { data: null, fetching: false, error: { message: 'Network error' } },
      jest.fn(),
    ] as never);

    const { result } = renderHook(() => useSmartViews());

    expect(result.current.error).toBe('Network error');
  });
});
