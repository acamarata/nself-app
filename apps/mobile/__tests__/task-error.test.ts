/**
 * Purpose: Tests for TaskError discriminated union and classifyUrqlError
 * Tests: all 5 variants; user messages; classification heuristics
 * SPORT: T-P3-E5-W3-S1-T01-c typed errors
 */

import { classifyUrqlError, taskUserMessage } from '../src/lib/task-error';
import type { TaskError } from '../src/lib/task-error';

describe('classifyUrqlError', () => {
  it('classifies rate limit errors', () => {
    const e = classifyUrqlError(new Error('429 rate limit exceeded'));
    expect(e.type).toBe('rate_limit');
  });

  it('classifies auth errors on 401', () => {
    const e = classifyUrqlError(new Error('401 Unauthorized'));
    expect(e.type).toBe('auth');
  });

  it('classifies auth errors on jwt keyword', () => {
    const e = classifyUrqlError(new Error('jwt expired'));
    expect(e.type).toBe('auth');
  });

  it('classifies network errors', () => {
    const e = classifyUrqlError(new Error('Network request failed'));
    expect(e.type).toBe('network');
  });

  it('classifies ECONNREFUSED as network', () => {
    const e = classifyUrqlError(new Error('ECONNREFUSED: connection refused'));
    expect(e.type).toBe('network');
  });

  it('defaults to server error for unknown errors', () => {
    const e = classifyUrqlError(new Error('Internal server error'));
    expect(e.type).toBe('server');
  });

  it('handles non-Error objects', () => {
    const e = classifyUrqlError('some string error');
    expect(['server', 'network', 'auth', 'rate_limit', 'validation']).toContain(e.type);
  });
});

describe('taskUserMessage', () => {
  const cases: Array<[TaskError, string]> = [
    [{ type: 'network', message: '' }, 'No connection'],
    [{ type: 'server', message: '' }, 'Server error'],
    [{ type: 'auth', message: '' }, 'Session expired'],
    [{ type: 'rate_limit', message: '' }, 'Too many requests'],
    [{ type: 'validation', message: '' }, 'Invalid input'],
  ];

  it.each(cases)('returns a user-friendly message for %s', (error, expectedSubstring) => {
    expect(taskUserMessage(error)).toContain(expectedSubstring);
  });

  it('includes countdown for rate_limit with retryAfter', () => {
    const msg = taskUserMessage({ type: 'rate_limit', message: '', retryAfter: 42 });
    expect(msg).toContain('42s');
  });
});

describe('Result<T,E>', () => {
  it('ok/err types work correctly', () => {
    const { ok, err, isOk, isErr } = require('../src/lib/result');
    const success = ok(42);
    const failure = err(new Error('oops'));
    expect(isOk(success)).toBe(true);
    expect(isErr(failure)).toBe(true);
    expect(isOk(failure)).toBe(false);
    expect(success.value).toBe(42);
    expect(failure.error.message).toBe('oops');
  });
});
