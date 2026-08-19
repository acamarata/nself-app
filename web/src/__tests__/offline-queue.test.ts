/**
 * offline-queue.test.ts — unit tests for offline mutation queue
 *
 * Uses MemoryAdapter (not IdbAdapter) for unit tests — IndexedDB is
 * unavailable in jsdom. Integration tests against the real IdbAdapter
 * live in Playwright e2e tests.
 */

import { describe, it, expect } from 'vitest';
import { QueueProcessor } from '@nself/offline-queue';
import { MemoryAdapter } from '@nself/offline-queue/adapters/memory';

// Structural smoke test — verify module exports the expected API
// without a DOM environment dependency. Integration tests use Playwright.
describe('offline-queue module', () => {
  it('exports an offlineQueue object', async () => {
    const mod = await import('@/lib/offline-queue');
    expect(mod.offlineQueue).toBeDefined();
    expect(typeof mod.offlineQueue.enqueue).toBe('function');
    expect(typeof mod.offlineQueue.size).toBe('function');
    expect(typeof mod.offlineQueue.drain).toBe('function');
  });

  it('drain returns processed/failed summary (MemoryAdapter)', async () => {
    // Use MemoryAdapter so this test works in jsdom (no IndexedDB needed).
    // QueueProcessor(adapter, executeFn, opts?) — executeFn is 2nd arg.
    const executor = async () => { /* no-op */ };
    const queue = new QueueProcessor(new MemoryAdapter(), executor, { maxRetries: 1, backoffMs: 0 });
    await queue.enqueue('test_mutation', { foo: 'bar' });
    const result = await queue.drain();
    expect(result).toMatchObject({ processed: expect.any(Number), failed: expect.any(Number) });
  });
});

// ─── Task mutation helpers ─────────────────────────────────────────────────────

describe('task priority filter logic', () => {
  type Priority = 'none' | 'low' | 'medium' | 'high' | 'urgent';
  type Filter = 'all' | 'active' | 'completed' | 'high' | 'urgent';

  interface Todo {
    id: string;
    title: string;
    completed: boolean;
    priority: Priority;
  }

  function applyFilter(todos: Todo[], filter: Filter): Todo[] {
    switch (filter) {
      case 'active': return todos.filter((t) => !t.completed);
      case 'completed': return todos.filter((t) => t.completed);
      case 'high': return todos.filter((t) => t.priority === 'high' || t.priority === 'urgent');
      case 'urgent': return todos.filter((t) => t.priority === 'urgent');
      default: return todos;
    }
  }

  const todos: Todo[] = [
    { id: '1', title: 'Buy milk', completed: false, priority: 'low' },
    { id: '2', title: 'Fix bug', completed: false, priority: 'urgent' },
    { id: '3', title: 'Write tests', completed: true, priority: 'high' },
    { id: '4', title: 'Deploy', completed: false, priority: 'high' },
    { id: '5', title: 'Review PR', completed: true, priority: 'none' },
  ];

  it('all filter returns all todos', () => {
    expect(applyFilter(todos, 'all')).toHaveLength(5);
  });

  it('active filter returns only incomplete todos', () => {
    const result = applyFilter(todos, 'active');
    expect(result.every((t) => !t.completed)).toBe(true);
    expect(result).toHaveLength(3);
  });

  it('completed filter returns only completed todos', () => {
    const result = applyFilter(todos, 'completed');
    expect(result.every((t) => t.completed)).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('high filter returns high and urgent priority todos', () => {
    const result = applyFilter(todos, 'high');
    expect(result).toHaveLength(3); // Fix bug (urgent), Write tests (high), Deploy (high)
    expect(result.every((t) => t.priority === 'high' || t.priority === 'urgent')).toBe(true);
  });

  it('urgent filter returns only urgent priority todos', () => {
    const result = applyFilter(todos, 'urgent');
    expect(result).toHaveLength(1);
    expect(result[0].priority).toBe('urgent');
  });
});

// ─── Project progress ring calculation ────────────────────────────────────────

describe('project progress calculation', () => {
  function calcProgress(total: number, completed: number): number {
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  }

  it('returns 0 when no tasks', () => {
    expect(calcProgress(0, 0)).toBe(0);
  });

  it('returns 100 when all tasks complete', () => {
    expect(calcProgress(5, 5)).toBe(100);
  });

  it('returns 50 for half completed', () => {
    expect(calcProgress(4, 2)).toBe(50);
  });

  it('rounds correctly', () => {
    // 1/3 = 33.3... → rounds to 33
    expect(calcProgress(3, 1)).toBe(33);
  });
});
