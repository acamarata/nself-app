/**
 * Purpose: MMKV-backed offline mutation queue for ɳTask
 * Inputs: Mutation payloads enqueued while offline; urql client on reconnect
 * Outputs: Persistent FIFO queue; processes on reconnect; notifies on failure
 * Constraints:
 *   - Uses react-native-mmkv as primary storage (survives app kill + backgrounding).
 *   - Falls back to @react-native-async-storage/async-storage when MMKV is unavailable
 *     (e.g. Expo Go / simulator without native build).
 *   - Queue is FIFO; mutations dispatched in enqueue order on reconnect.
 *   - Idempotency key stored with each entry — server deduplication prevents double-creates.
 *   - On permanent failure (3 retries): entry removed and caller notified via onFailure callback.
 * SPORT: T-P3-E5-W3-S1-T01-a offline queue
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------------------
// Storage adapter — MMKV primary, AsyncStorage fallback
// ---------------------------------------------------------------------------

interface StorageAdapter {
  getString(key: string): string | undefined | null;
  set(key: string, value: string): void;
  delete(key: string): void;
}

let _storage: StorageAdapter | null = null;

function getStorage(): StorageAdapter {
  if (_storage) return _storage;

  try {
    // Dynamic require — avoids hard crash in Expo Go where native module is absent
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
    const mmkv = new MMKV({ id: 'ntask-offline-queue' });
    _storage = {
      getString: (key) => mmkv.getString(key),
      set: (key, value) => mmkv.set(key, value),
      delete: (key) => mmkv.delete(key),
    };
    return _storage;
  } catch {
    // Expo Go / no native build — use AsyncStorage synchronously via an in-memory cache
    const memCache: Record<string, string> = {};
    const ASYNC_KEY = 'ntask:offline-queue:v1';

    // Bootstrap: load from AsyncStorage into memCache synchronously-ish
    AsyncStorage.getItem(ASYNC_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Record<string, string>;
          Object.assign(memCache, parsed);
        } catch {
          // Ignore corrupt cache
        }
      }
    });

    const persist = () => {
      AsyncStorage.setItem(ASYNC_KEY, JSON.stringify(memCache)).catch(() => {
        // Best-effort; app will re-sync on next launch
      });
    };

    _storage = {
      getString: (key) => memCache[key] ?? null,
      set: (key, value) => {
        memCache[key] = value;
        persist();
      },
      delete: (key) => {
        delete memCache[key];
        persist();
      },
    };
    return _storage;
  }
}

// ---------------------------------------------------------------------------
// Queue entry types
// ---------------------------------------------------------------------------

export type QueuedMutationType =
  | 'create_task'
  | 'update_task'
  | 'toggle_task'
  | 'delete_task'
  | 'create_list'
  | 'update_list'
  | 'delete_list';

export interface QueuedMutation {
  /** Unique entry ID — used to remove from queue after success */
  id: string;
  type: QueuedMutationType;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  enqueuedAt: number;
  retries: number;
}

const QUEUE_KEY = 'ntask:mutation-queue:v1';
const MAX_RETRIES = 3;

// ---------------------------------------------------------------------------
// Queue operations
// ---------------------------------------------------------------------------

function readQueue(): QueuedMutation[] {
  try {
    const raw = getStorage().getString(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedMutation[];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedMutation[]): void {
  getStorage().set(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Add a mutation to the tail of the queue.
 */
export function enqueue(entry: Omit<QueuedMutation, 'id' | 'enqueuedAt' | 'retries'>): QueuedMutation {
  const mutation: QueuedMutation = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    enqueuedAt: Date.now(),
    retries: 0,
  };
  const queue = readQueue();
  queue.push(mutation);
  writeQueue(queue);
  return mutation;
}

/**
 * Remove a successfully processed entry from the queue.
 */
export function dequeue(id: string): void {
  const queue = readQueue().filter((m) => m.id !== id);
  writeQueue(queue);
}

/**
 * Increment retry count for an entry. If >= MAX_RETRIES, remove it and return true (failed).
 */
export function markRetry(id: string): boolean {
  const queue = readQueue();
  const idx = queue.findIndex((m) => m.id === id);
  if (idx === -1) return false;
  queue[idx].retries += 1;
  if (queue[idx].retries >= MAX_RETRIES) {
    queue.splice(idx, 1);
    writeQueue(queue);
    return true; // permanent failure
  }
  writeQueue(queue);
  return false;
}

/**
 * Read the full queue (FIFO order).
 */
export function peekQueue(): QueuedMutation[] {
  return readQueue();
}

/**
 * How many entries are currently queued.
 */
export function queueLength(): number {
  return readQueue().length;
}

/**
 * Clear all queued mutations (use with caution — for testing/reset).
 */
export function clearQueue(): void {
  writeQueue([]);
}

// ---------------------------------------------------------------------------
// Sync execution — called by useNetworkState hook on reconnect
// ---------------------------------------------------------------------------

export type MutationExecutor = (mutation: QueuedMutation) => Promise<boolean>;

/**
 * Process all queued mutations in FIFO order.
 * @param execute - Async function that performs the mutation; returns true on success.
 * @param onFailure - Called when a mutation permanently fails (max retries exceeded).
 */
export async function processQueue(
  execute: MutationExecutor,
  onFailure?: (mutation: QueuedMutation) => void,
): Promise<{ synced: number; failed: number }> {
  const queue = peekQueue();
  let synced = 0;
  let failed = 0;

  for (const mutation of queue) {
    try {
      const success = await execute(mutation);
      if (success) {
        dequeue(mutation.id);
        synced += 1;
      } else {
        const permanentFail = markRetry(mutation.id);
        if (permanentFail) {
          failed += 1;
          onFailure?.(mutation);
        }
      }
    } catch {
      const permanentFail = markRetry(mutation.id);
      if (permanentFail) {
        failed += 1;
        onFailure?.(mutation);
      }
    }
  }

  return { synced, failed };
}
