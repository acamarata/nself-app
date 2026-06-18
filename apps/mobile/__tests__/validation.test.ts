/**
 * Purpose: Tests for Zod-compatible validation schemas
 * Tests: taskCreateSchema, projectCreateSchema — valid/invalid cases
 * SPORT: T-P3-E5-W3-S1-T01-c Zod schema tests
 */

import { taskCreateSchema, projectCreateSchema } from '../src/lib/validation';

describe('taskCreateSchema', () => {
  it('passes with a valid title and listId', () => {
    const result = taskCreateSchema({ title: 'Buy milk', listId: 'abc-123' });
    expect(result.success).toBe(true);
    expect(result.data?.title).toBe('Buy milk');
    expect(result.data?.listId).toBe('abc-123');
  });

  it('trims title whitespace', () => {
    const result = taskCreateSchema({ title: '  Buy milk  ', listId: 'abc' });
    expect(result.success).toBe(true);
    expect(result.data?.title).toBe('Buy milk');
  });

  it('fails when title is empty', () => {
    const result = taskCreateSchema({ title: '', listId: 'abc' });
    expect(result.success).toBe(false);
    expect(result.errors?.[0].field).toBe('title');
  });

  it('fails when title is whitespace only', () => {
    const result = taskCreateSchema({ title: '   ', listId: 'abc' });
    expect(result.success).toBe(false);
  });

  it('fails when title exceeds 200 chars', () => {
    const result = taskCreateSchema({ title: 'a'.repeat(201), listId: 'abc' });
    expect(result.success).toBe(false);
    expect(result.errors?.[0].field).toBe('title');
  });

  it('passes with title exactly 200 chars', () => {
    const result = taskCreateSchema({ title: 'a'.repeat(200), listId: 'abc' });
    expect(result.success).toBe(true);
  });

  it('fails when listId is missing', () => {
    const result = taskCreateSchema({ title: 'Test' });
    expect(result.success).toBe(false);
    expect(result.errors?.[0].field).toBe('listId');
  });

  it('accepts null dueDate', () => {
    const result = taskCreateSchema({ title: 'Test', listId: 'abc', dueDate: null });
    expect(result.success).toBe(true);
    expect(result.data?.dueDate).toBeNull();
  });

  it('accepts valid ISO date as dueDate', () => {
    const result = taskCreateSchema({ title: 'Test', listId: 'abc', dueDate: '2026-12-31' });
    expect(result.success).toBe(true);
    expect(result.data?.dueDate).toBe('2026-12-31');
  });

  it('fails with invalid dueDate', () => {
    const result = taskCreateSchema({ title: 'Test', listId: 'abc', dueDate: 'not-a-date' });
    expect(result.success).toBe(false);
    expect(result.errors?.[0].field).toBe('dueDate');
  });
});

describe('projectCreateSchema', () => {
  it('passes with a valid title', () => {
    const result = projectCreateSchema({ title: 'Work' });
    expect(result.success).toBe(true);
    expect(result.data?.title).toBe('Work');
  });

  it('fails when title is empty', () => {
    const result = projectCreateSchema({ title: '' });
    expect(result.success).toBe(false);
    expect(result.errors?.[0].field).toBe('title');
  });

  it('fails when title exceeds 100 chars', () => {
    const result = projectCreateSchema({ title: 'a'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('accepts a valid hex color', () => {
    const result = projectCreateSchema({ title: 'Work', color: '#6366f1' });
    expect(result.success).toBe(true);
    expect(result.data?.color).toBe('#6366f1');
  });

  it('fails with invalid hex color', () => {
    const result = projectCreateSchema({ title: 'Work', color: 'indigo' });
    expect(result.success).toBe(false);
    expect(result.errors?.[0].field).toBe('color');
  });
});
