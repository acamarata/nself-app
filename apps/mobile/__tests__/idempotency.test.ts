/**
 * Purpose: Tests for idempotency key generation
 * Tests: same inputs within window = same key; different inputs = different key
 * SPORT: T-P3-E5-W3-S1-T01-c idempotency
 */

import { generateIdempotencyKey } from '../src/lib/idempotency';

describe('generateIdempotencyKey', () => {
  it('returns a non-empty string', () => {
    const key = generateIdempotencyKey('create_task', 'list-1:Buy milk');
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(0);
  });

  it('returns the same key for the same inputs within the same time window', () => {
    const k1 = generateIdempotencyKey('create_task', 'list-1:Buy milk', 60_000);
    const k2 = generateIdempotencyKey('create_task', 'list-1:Buy milk', 60_000);
    expect(k1).toBe(k2);
  });

  it('returns different keys for different mutation types', () => {
    const k1 = generateIdempotencyKey('create_task', 'seed');
    const k2 = generateIdempotencyKey('delete_task', 'seed');
    expect(k1).not.toBe(k2);
  });

  it('returns different keys for different seeds', () => {
    const k1 = generateIdempotencyKey('create_task', 'seed-a');
    const k2 = generateIdempotencyKey('create_task', 'seed-b');
    expect(k1).not.toBe(k2);
  });

  it('returns UUID-like format (contains hyphens)', () => {
    const key = generateIdempotencyKey('create_task', 'test');
    expect(key).toMatch(/^[0-9a-f]+-[0-9a-f]+-[0-9a-f]+-[0-9a-f]+-[0-9a-f]+$/);
  });

  it('returns a different key for a different time window (simulated)', () => {
    // Very short window (1ms) so two calls separated by >1ms will produce different keys
    const k1 = generateIdempotencyKey('create_task', 'seed', 1);
    const delay = new Promise<void>((r) => setTimeout(r, 5));
    return delay.then(() => {
      const k2 = generateIdempotencyKey('create_task', 'seed', 1);
      expect(k1).not.toBe(k2);
    });
  });
});
