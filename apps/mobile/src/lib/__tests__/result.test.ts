/**
 * Purpose: Full branch + line coverage for src/lib/result.ts.
 *   Covers Ok/Err constructors, type guards, and both branches of mapOk.
 * Inputs: Pure functions — no mocks needed
 * Outputs: Asserts discriminated union shape and all control-flow branches
 * Constraints: Zero dependencies; no RN/Expo APIs used.
 * SPORT: T-P3-E5-W3-S1-T01-c typed errors
 */

import { ok, err, isOk, isErr, mapOk } from '../result';
import type { Result } from '../result';

// ─── ok() constructor ─────────────────────────────────────────────────────────

describe('ok()', () => {
  it('returns { ok: true, value } for a number', () => {
    const result = ok(42);
    expect(result).toEqual({ ok: true, value: 42 });
  });

  it('returns { ok: true, value } for a string', () => {
    const result = ok('hello');
    expect(result).toEqual({ ok: true, value: 'hello' });
  });

  it('works with null value', () => {
    const result = ok(null);
    expect(result).toEqual({ ok: true, value: null });
  });

  it('works with an object value', () => {
    const result = ok({ nested: true, count: 7 });
    expect(result).toEqual({ ok: true, value: { nested: true, count: 7 } });
  });

  it('works with an array value', () => {
    const result = ok([1, 2, 3]);
    expect(result).toEqual({ ok: true, value: [1, 2, 3] });
  });

  it('sets ok: true', () => {
    expect(ok('x').ok).toBe(true);
  });
});

// ─── err() constructor ────────────────────────────────────────────────────────

describe('err()', () => {
  it('returns { ok: false, error } for a string error', () => {
    const result = err('fail');
    expect(result).toEqual({ ok: false, error: 'fail' });
  });

  it('returns { ok: false, error } for an Error object', () => {
    const e = new Error('boom');
    const result = err(e);
    expect(result.ok).toBe(false);
    expect(result.error).toBe(e);
  });

  it('works with numeric error codes', () => {
    const result = err(404);
    expect(result).toEqual({ ok: false, error: 404 });
  });

  it('sets ok: false', () => {
    expect(err('x').ok).toBe(false);
  });
});

// ─── isOk() ───────────────────────────────────────────────────────────────────

describe('isOk()', () => {
  it('returns true for an Ok result', () => {
    expect(isOk(ok(1))).toBe(true);
  });

  it('returns false for an Err result', () => {
    expect(isOk(err('x'))).toBe(false);
  });

  it('narrows type to Ok<T> inside if-block (TypeScript compile-time guard)', () => {
    const result: Result<number, string> = ok(99);
    if (isOk(result)) {
      // TypeScript should allow accessing .value here without error
      expect(result.value).toBe(99);
    }
  });
});

// ─── isErr() ──────────────────────────────────────────────────────────────────

describe('isErr()', () => {
  it('returns true for an Err result', () => {
    expect(isErr(err('x'))).toBe(true);
  });

  it('returns false for an Ok result', () => {
    expect(isErr(ok(1))).toBe(false);
  });

  it('narrows type to Err<E> inside if-block', () => {
    const result: Result<number, string> = err('gone wrong');
    if (isErr(result)) {
      expect(result.error).toBe('gone wrong');
    }
  });
});

// ─── mapOk() — both branches ─────────────────────────────────────────────────

describe('mapOk()', () => {
  it('maps the value when result is Ok (Ok branch)', () => {
    const result = mapOk(ok(5), (x) => x * 2);
    expect(result).toEqual(ok(10));
  });

  it('passes through unchanged when result is Err (Err branch — previously uncovered)', () => {
    const original = err('e');
    const result = mapOk(original, (x: number) => x * 2);
    expect(result).toEqual(err('e'));
    // Confirm the exact same error object is returned
    expect((result as { ok: false; error: string }).error).toBe('e');
  });

  it('returns Ok with transformed value for string input', () => {
    const result = mapOk(ok('hello'), (s) => s.toUpperCase());
    expect(result).toEqual(ok('HELLO'));
  });

  it('does not call the mapping fn when result is Err', () => {
    const fn = jest.fn();
    mapOk(err('nope'), fn);
    expect(fn).not.toHaveBeenCalled();
  });

  it('calls the mapping fn exactly once when result is Ok', () => {
    const fn = jest.fn().mockReturnValue(42);
    mapOk(ok(21), fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(21);
  });

  it('works with object transformation', () => {
    const input = ok({ count: 3 });
    const result = mapOk(input, (v) => ({ count: v.count * 10 }));
    expect(result).toEqual(ok({ count: 30 }));
  });

  it('preserves original Err value type through mapOk', () => {
    const errResult: Result<number, { code: number }> = err({ code: 500 });
    const mapped = mapOk(errResult, (n: number) => n + 1);
    expect(mapped).toEqual(err({ code: 500 }));
  });
});

// ─── Discriminated union structural checks ────────────────────────────────────

describe('Result discriminated union', () => {
  it('ok and err are mutually exclusive on the ok flag', () => {
    const success: Result<string, number> = ok('yes');
    const failure: Result<string, number> = err(0);

    expect(success.ok).not.toBe(failure.ok);
  });

  it('can be used in a switch-like pattern', () => {
    function handle(r: Result<number, string>): string {
      if (isOk(r)) return `value:${r.value}`;
      return `error:${r.error}`;
    }

    expect(handle(ok(7))).toBe('value:7');
    expect(handle(err('oops'))).toBe('error:oops');
  });
});
