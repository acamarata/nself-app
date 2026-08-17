import { describe, it, expect } from 'vitest';
import { findTaskByIdOrTitle, type Task } from '../src/lib/tasks-api.js';

const tasks: Task[] = [
  { id: 'abc-123', list_id: 'l1', title: 'Buy milk', completed: false, priority: 'low', due_date: null, position: 0 },
  { id: 'def-456', list_id: 'l1', title: 'Write CLI smoke task', completed: false, priority: 'high', due_date: null, position: 1 },
  { id: 'ghi-789', list_id: 'l1', title: 'Ship release', completed: true, priority: 'medium', due_date: null, position: 2 },
];

describe('findTaskByIdOrTitle', () => {
  it('matches by exact id', () => {
    expect(findTaskByIdOrTitle(tasks, 'def-456')?.title).toBe('Write CLI smoke task');
  });

  it('matches by exact title (case-insensitive)', () => {
    expect(findTaskByIdOrTitle(tasks, 'ship release')?.id).toBe('ghi-789');
  });

  it('matches by fuzzy substring', () => {
    expect(findTaskByIdOrTitle(tasks, 'smoke')?.id).toBe('def-456');
  });

  it('returns undefined when nothing matches', () => {
    expect(findTaskByIdOrTitle(tasks, 'nonexistent-xyz')).toBeUndefined();
  });
});
