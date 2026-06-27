/**
 * Purpose: Unit tests for date-bucket logic in useTVTasks.
 * These tests exercise the pure date math without React/urql dependencies.
 * SPORT: Epic F — TV scaffold.
 */

// Inline the bucket function for isolated testing (pure fn, no React dep)
function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function bucketTask(dueDate: string | null, today: string): 'today' | 'overdue' | 'upcoming' {
  if (!dueDate) return 'upcoming';
  const due = dueDate.substring(0, 10);
  if (due === today) return 'today';
  if (due < today) return 'overdue';
  return 'upcoming';
}

describe('bucketTask', () => {
  const today = todayDateString();

  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const tomorrow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  test('null due_date → upcoming', () => {
    expect(bucketTask(null, today)).toBe('upcoming');
  });

  test('today → today', () => {
    expect(bucketTask(today, today)).toBe('today');
  });

  test('yesterday → overdue', () => {
    expect(bucketTask(yesterday, today)).toBe('overdue');
  });

  test('tomorrow → upcoming', () => {
    expect(bucketTask(tomorrow, today)).toBe('upcoming');
  });

  test('ISO datetime string truncated correctly', () => {
    // Hasura returns datetime with time component — we only compare date portion
    expect(bucketTask(`${today}T12:00:00.000Z`, today)).toBe('today');
  });
});
