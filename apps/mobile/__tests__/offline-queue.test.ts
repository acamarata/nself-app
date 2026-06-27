/**
 * Purpose: Tests for MMKV-backed offline mutation queue wrapper.
 * Tests the async wrapper API: enqueue/peekQueue/queueSize/clearQueue/drainQueue.
 * The wrapper delegates to @nself/offline-queue QueueProcessor + MmkvAdapter.
 *
 * API under test (apps/mobile/src/lib/offline-queue.ts):
 *   enqueue(type, payload, idempotencyKey?)  → Promise<void>
 *   peekQueue()                              → Promise<QueuedMutation[]>
 *   queueSize()                              → Promise<number>
 *   clearQueue()                             → Promise<void>
 *   drainQueue(executeFn)                    → Promise<{ processed: number; failed: number }>
 *
 * QueuedMutation shape (from @nself/offline-queue):
 *   { id, type, payload, retryCount, maxRetries, enqueuedAt, lastAttemptAt? }
 *
 * SPORT: T-P3-E5-W3-S1-T01-a acceptance: offline queue, optimistic rollback
 */

// MMKV is mapped to __mocks__/react-native-mmkv.js via jest.config.js moduleNameMapper.
// The mock uses an in-memory store keyed by MMKV id. Shared across the module under test
// and drainQueue (both call getMmkv() which constructs MMKV({ id: 'ntask-offline-queue' })).

// Silence the fake-timers warning for async tests — we advance timers manually only in the
// retry-exhaustion test to skip the 500 ms exponential backoff.
jest.useFakeTimers();

jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
  },
}));

import {
  enqueue,
  peekQueue,
  queueSize,
  clearQueue,
  drainQueue,
} from '../src/lib/offline-queue';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Advance all pending timers and flush the micro-task queue. */
async function flushTimers(): Promise<void> {
  jest.runAllTimers();
  await Promise.resolve();
}

beforeEach(async () => {
  // Reset the MMKV in-memory store between tests.
  // clearQueue() calls getProcessor().clear() which calls adapter.clear().
  // We also need to reset _processor so a fresh adapter is created,
  // since jest.resetModules is not used (it would break the mock wiring).
  // Instead: clear the queue and reset the singleton via the exposed clearQueue().
  await clearQueue();
  // Reset the internal _processor singleton so each test starts with a fresh processor
  // pointing at the (now-cleared) MMKV store.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('../src/lib/offline-queue') as { _resetProcessor?: () => void };
  if (typeof mod._resetProcessor === 'function') {
    mod._resetProcessor();
  }
});

// ── enqueue / peekQueue / queueSize ───────────────────────────────────────────

describe('offline-queue: enqueue / peekQueue / queueSize', () => {
  it('enqueues a mutation and peeks it', async () => {
    await enqueue('create_task', { title: 'Buy milk' }, 'k1');
    const q = await peekQueue();
    expect(q).toHaveLength(1);
    expect(q[0]?.type).toBe('create_task');
    expect(q[0]?.payload).toEqual({ title: 'Buy milk' });
    expect(q[0]?.id).toBe('k1');
    expect(q[0]?.retryCount).toBe(0);
  });

  it('maintains FIFO insertion order across multiple enqueues', async () => {
    await enqueue('create_task', { title: 'First' }, 'k1');
    await enqueue('toggle_task', { id: 'xyz', completed: true }, 'k2');
    await enqueue('delete_task', { id: 'abc' }, 'k3');
    const q = await peekQueue();
    expect(q).toHaveLength(3);
    expect(q[0]?.type).toBe('create_task');
    expect(q[1]?.type).toBe('toggle_task');
    expect(q[2]?.type).toBe('delete_task');
  });

  it('queueSize returns correct count', async () => {
    expect(await queueSize()).toBe(0);
    await enqueue('create_task', {}, 'k1');
    await enqueue('create_task', {}, 'k2');
    expect(await queueSize()).toBe(2);
    await clearQueue();
    expect(await queueSize()).toBe(0);
  });

  it('deduplicates items with the same idempotencyKey', async () => {
    await enqueue('create_task', { title: 'A' }, 'same-key');
    await enqueue('create_task', { title: 'B' }, 'same-key');
    expect(await queueSize()).toBe(1);
    const q = await peekQueue();
    // First write wins
    expect((q[0]?.payload as { title: string })?.title).toBe('A');
  });

  it('auto-generates an id when no idempotencyKey is provided', async () => {
    await enqueue('create_task', { title: 'No key' });
    const q = await peekQueue();
    expect(q).toHaveLength(1);
    expect(typeof q[0]?.id).toBe('string');
    expect(q[0]?.id.length).toBeGreaterThan(0);
  });
});

// ── drainQueue: success paths ──────────────────────────────────────────────────

describe('offline-queue: drainQueue — success paths', () => {
  it('calls executor for each entry in FIFO order and clears the queue on success', async () => {
    await enqueue('create_task', { title: 'T1' }, 'k1');
    await enqueue('create_task', { title: 'T2' }, 'k2');

    const order: string[] = [];
    const executor = jest.fn(async (m) => {
      order.push((m.payload as { title: string }).title);
    });

    const drainPromise = drainQueue(executor);
    await flushTimers();
    const result = await drainPromise;

    expect(result.processed).toBe(2);
    expect(result.failed).toBe(0);
    expect(order).toEqual(['T1', 'T2']);
    expect(await queueSize()).toBe(0);
  });

  it('returns { processed: 0, failed: 0 } when the queue is empty', async () => {
    const executor = jest.fn();
    const drainPromise = drainQueue(executor);
    await flushTimers();
    const result = await drainPromise;
    expect(result).toEqual({ processed: 0, failed: 0 });
    expect(executor).not.toHaveBeenCalled();
  });
});

// ── drainQueue: failure / retry paths ─────────────────────────────────────────

describe('offline-queue: drainQueue — failure / retry exhaustion', () => {
  it('permanently removes entry and counts it as failed after maxRetries exhausted', async () => {
    // QueueProcessor defaults: maxRetries = 3, backoffMs = 500.
    // drain() retries inline until retryCount > maxRetries (i.e. 4 attempts total).
    // We advance timers between each await so the exponential backoff delays resolve.
    await enqueue('create_task', {}, 'k1');

    const executor = jest.fn().mockRejectedValue(new Error('network error'));
    const drainPromise = drainQueue(executor);

    // Advance through all backoff delays: 500, 1000, 2000 ms + micro-tasks.
    for (let i = 0; i < 10; i++) {
      jest.advanceTimersByTime(4000);
      await Promise.resolve();
    }

    const result = await drainPromise;
    expect(result.failed).toBe(1);
    expect(result.processed).toBe(0);
    expect(await queueSize()).toBe(0);
  });

  it('processes successful items even when a later item fails', async () => {
    await enqueue('create_task', { title: 'succeed' }, 'k-ok');
    await enqueue('create_task', { title: 'fail' }, 'k-fail');

    let callCount = 0;
    const executor = jest.fn(async (m) => {
      callCount++;
      const payload = m.payload as { title: string };
      if (payload.title === 'fail') {
        throw new Error('executor error');
      }
    });

    const drainPromise = drainQueue(executor);
    // Advance timers to clear backoff delays on the failing item
    for (let i = 0; i < 10; i++) {
      jest.advanceTimersByTime(4000);
      await Promise.resolve();
    }

    const result = await drainPromise;
    // The first item succeeded, the second failed after exhausting retries
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);
    expect(await queueSize()).toBe(0);
  });
});
