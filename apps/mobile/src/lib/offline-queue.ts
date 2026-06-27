/**
 * Purpose: Offline mutation queue for ɳTask mobile.
 * Uses @nself/offline-queue QueueProcessor + MmkvAdapter.
 * SPORT: P5-C-mobile data layer rewire.
 */

import { QueueProcessor } from '@nself/offline-queue';
import { createMmkvAdapter } from '@nself/offline-queue/adapters';

/** Discriminated mutation type strings */
export type QueuedMutationType =
  | 'create_task'
  | 'update_task'
  | 'toggle_task'
  | 'delete_task'
  | 'create_list'
  | 'update_list'
  | 'delete_list'
  | 'create_subtask'
  | 'toggle_subtask'
  | 'delete_subtask'
  | 'create_comment'
  | 'delete_comment'
  | 'add_todo_tag'
  | 'remove_todo_tag';

/** Re-export QueuedMutation from @nself/offline-queue */
export type { QueuedMutation, TypedQueuedMutation } from '@nself/offline-queue';

let _processor: QueueProcessor | null = null;

function getProcessor(): QueueProcessor {
  if (_processor) return _processor;
  _processor = new QueueProcessor(
    createMmkvAdapter(getMmkv()),
    async () => {
      // Replaced at runtime by useOfflineSync via drainQueue
      throw new Error('executor not set');
    },
    { maxRetries: 3, backoffMs: 500 },
  );
  return _processor;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMmkv(): any {
  try {
    // Dynamic require so Expo Go (no native build) doesn't hard-crash
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
    return new MMKV({ id: 'ntask-offline-queue' });
  } catch {
    // Fallback stub for Expo Go / Jest
    const mem: Record<string, string> = {};
    return {
      getString: (k: string) => mem[k] ?? null,
      set: (k: string, v: string) => { mem[k] = v; },
      delete: (k: string) => { delete mem[k]; },
    };
  }
}

export async function enqueue(
  type: QueuedMutationType,
  payload: unknown,
  idempotencyKey?: string,
): Promise<void> {
  await getProcessor().enqueue(type, payload, idempotencyKey);
}

export async function drainQueue(
  executeFn: (m: import('@nself/offline-queue').QueuedMutation) => Promise<void>,
): Promise<{ processed: number; failed: number }> {
  const realProcessor = new QueueProcessor(
    createMmkvAdapter(getMmkv()),
    executeFn,
    { maxRetries: 3, backoffMs: 500 },
  );
  return realProcessor.drain();
}

export async function peekQueue(): Promise<import('@nself/offline-queue').QueuedMutation[]> {
  return getProcessor().peek();
}

export async function queueSize(): Promise<number> {
  return getProcessor().size();
}

export async function clearQueue(): Promise<void> {
  await getProcessor().clear();
}
