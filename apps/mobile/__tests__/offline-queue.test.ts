/**
 * Purpose: Tests for MMKV-backed offline mutation queue
 * Tests: enqueue/dequeue, FIFO order, retry logic, processQueue success/failure paths
 * SPORT: T-P3-E5-W3-S1-T01-a acceptance: offline queue, optimistic rollback
 */

// MMKV is mapped to __mocks__/react-native-mmkv.js via jest.config.js moduleNameMapper.
// AsyncStorage is mapped by jest-expo preset.
jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
  },
}));

import {
  enqueue,
  dequeue,
  markRetry,
  peekQueue,
  queueLength,
  clearQueue,
  processQueue,
} from '../src/lib/offline-queue';

beforeEach(() => {
  clearQueue();
});

describe('offline-queue: enqueue / dequeue', () => {
  it('enqueues a mutation and peeks it', () => {
    enqueue({ type: 'create_task', payload: { title: 'Buy milk' }, idempotencyKey: 'k1' });
    const q = peekQueue();
    expect(q).toHaveLength(1);
    expect(q[0].type).toBe('create_task');
    expect(q[0].payload.title).toBe('Buy milk');
    expect(q[0].idempotencyKey).toBe('k1');
    expect(q[0].retries).toBe(0);
  });

  it('dequeues by id and removes only that entry', () => {
    const a = enqueue({ type: 'create_task', payload: { title: 'A' }, idempotencyKey: 'ka' });
    const b = enqueue({ type: 'create_task', payload: { title: 'B' }, idempotencyKey: 'kb' });
    dequeue(a.id);
    const q = peekQueue();
    expect(q).toHaveLength(1);
    expect(q[0].id).toBe(b.id);
  });

  it('maintains FIFO order across multiple enqueues', () => {
    enqueue({ type: 'create_task', payload: { title: 'First' }, idempotencyKey: 'k1' });
    enqueue({ type: 'toggle_task', payload: { id: 'xyz', completed: true }, idempotencyKey: 'k2' });
    enqueue({ type: 'delete_task', payload: { id: 'abc' }, idempotencyKey: 'k3' });
    const q = peekQueue();
    expect(q[0].payload.title).toBe('First');
    expect(q[1].type).toBe('toggle_task');
    expect(q[2].type).toBe('delete_task');
  });

  it('queueLength returns correct count', () => {
    expect(queueLength()).toBe(0);
    enqueue({ type: 'create_task', payload: {}, idempotencyKey: 'k1' });
    enqueue({ type: 'create_task', payload: {}, idempotencyKey: 'k2' });
    expect(queueLength()).toBe(2);
    clearQueue();
    expect(queueLength()).toBe(0);
  });
});

describe('offline-queue: retry logic', () => {
  it('increments retry count on markRetry without permanent fail (< MAX_RETRIES)', () => {
    const m = enqueue({ type: 'create_task', payload: {}, idempotencyKey: 'k1' });
    const failed = markRetry(m.id);
    expect(failed).toBe(false);
    const q = peekQueue();
    expect(q[0].retries).toBe(1);
  });

  it('permanently fails and removes entry after MAX_RETRIES (3)', () => {
    const m = enqueue({ type: 'create_task', payload: {}, idempotencyKey: 'k1' });
    markRetry(m.id);
    markRetry(m.id);
    const failed = markRetry(m.id);
    expect(failed).toBe(true);
    expect(queueLength()).toBe(0);
  });
});

describe('offline-queue: processQueue', () => {
  it('calls executor for each entry in FIFO order and dequeues on success', async () => {
    enqueue({ type: 'create_task', payload: { title: 'T1' }, idempotencyKey: 'k1' });
    enqueue({ type: 'create_task', payload: { title: 'T2' }, idempotencyKey: 'k2' });

    const order: string[] = [];
    const executor = jest.fn(async (m) => {
      order.push(m.payload.title as string);
      return true; // success
    });

    const result = await processQueue(executor);
    expect(result.synced).toBe(2);
    expect(result.failed).toBe(0);
    expect(order).toEqual(['T1', 'T2']);
    expect(queueLength()).toBe(0);
  });

  it('calls onFailure and removes entry after max retries via processQueue', async () => {
    enqueue({ type: 'create_task', payload: {}, idempotencyKey: 'k1' });

    const failures: string[] = [];
    const failExecutor = jest.fn().mockResolvedValue(false);

    // Run 3 times to exhaust retries
    await processQueue(failExecutor, (m) => failures.push(m.idempotencyKey));
    await processQueue(failExecutor, (m) => failures.push(m.idempotencyKey));
    const result = await processQueue(failExecutor, (m) => failures.push(m.idempotencyKey));

    expect(result.failed).toBe(1);
    expect(failures).toContain('k1');
    expect(queueLength()).toBe(0);
  });

  it('leaves entry in queue if executor succeeds partially', async () => {
    enqueue({ type: 'create_task', payload: { title: 'A' }, idempotencyKey: 'k1' });
    enqueue({ type: 'create_task', payload: { title: 'B' }, idempotencyKey: 'k2' });

    let callCount = 0;
    const executor = jest.fn(async () => {
      callCount++;
      return callCount === 1; // first succeeds, second fails
    });

    await processQueue(executor);
    // First entry dequeued; second gets a retry
    expect(queueLength()).toBe(1);
    expect(peekQueue()[0].retries).toBe(1);
  });
});
