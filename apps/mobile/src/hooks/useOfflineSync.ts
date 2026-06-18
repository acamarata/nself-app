/**
 * Purpose: App-level offline-sync driver — drains the persisted mutation queue on reconnect.
 * Inputs: None (reads the MMKV/AsyncStorage-backed queue + system network state).
 * Outputs: Replays each queued mutation through urql on offline→online transition;
 *          removes succeeded entries, retries/expires failed ones, notifies on permanent failure.
 * Constraints:
 *   - MUST be mounted inside the urql Provider + auth gate (see AuthenticatedApp) so
 *     useTaskMutations has a live client. This is the "NetworkStateProvider at app level"
 *     the offline-queue + ListScreen comments reference.
 *   - Each replay re-sends the entry's stored idempotencyKey so the server dedups
 *     against the optimistic write that may already have landed before disconnect.
 *   - Executor returns true on success (no GraphQL error) so processQueue dequeues it;
 *     false triggers markRetry (up to MAX_RETRIES) inside processQueue.
 * SPORT: T-P3-E5-W3-S1-T01-a offline queue + T01-c idempotency
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useNetworkState } from './useNetworkState';
import { useTaskMutations } from './useTaskMutations';
import { processQueue, type QueuedMutation } from '../lib/offline-queue';

/**
 * Wire the persisted mutation queue to network reconnects.
 * Mount once, high in the authenticated tree (inside the urql Provider).
 */
export function useOfflineSync(): void {
  const {
    createTask, updateTask, toggleTask, deleteTask,
    createList, updateList, deleteList,
  } = useTaskMutations();

  /** Replay a single queued mutation; returns true when it lands without a GraphQL error. */
  const execute = useCallback(
    async (m: QueuedMutation): Promise<boolean> => {
      const p = m.payload;
      const key = m.idempotencyKey;
      let result;
      switch (m.type) {
        case 'create_task':
          result = await createTask(String(p.title ?? ''), key);
          break;
        case 'update_task':
          result = await updateTask(String(p.id), (p.fields as Record<string, unknown>) ?? {}, key);
          break;
        case 'toggle_task':
          result = await toggleTask(String(p.id), Boolean(p.completed), key);
          break;
        case 'delete_task':
          result = await deleteTask(String(p.id), key);
          break;
        case 'create_list':
          result = await createList(String(p.title ?? ''), (p.color as string) ?? undefined, key);
          break;
        case 'update_list':
          result = await updateList(String(p.id), (p.fields as Record<string, unknown>) ?? {}, key);
          break;
        case 'delete_list':
          result = await deleteList(String(p.id), key);
          break;
        default:
          // Unknown type — drop it (treat as success so it does not wedge the queue).
          return true;
      }
      return !result?.error;
    },
    [createTask, updateTask, toggleTask, deleteTask, createList, updateList, deleteList],
  );

  const handleReconnect = useCallback(async () => {
    const { synced, failed } = await processQueue(execute, (m) => {
      // Permanent failure after max retries — surface once so the user can re-enter manually.
      Alert.alert(
        'Some changes could not be synced',
        `A queued ${m.type.replace('_', ' ')} failed after several attempts and was discarded.`,
      );
    });
    if (synced > 0 || failed > 0) {
      // No-op aggregate hook point; per-entry effects already applied via urql cache.
    }
  }, [execute]);

  useNetworkState({ onReconnect: handleReconnect });
}
