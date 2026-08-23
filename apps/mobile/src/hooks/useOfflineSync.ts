/**
 * Purpose: Offline-sync driver — drains persisted mutation queue on reconnect.
 * Uses @nself/offline-queue QueueProcessor via drainQueue() wrapper.
 * SPORT: P5-C-mobile data layer rewire.
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import type { QueuedMutation } from '@nself/offline-queue';
import { useNetworkState } from './useNetworkState';
import { useTaskMutations, useSubtaskMutations, useCommentMutations } from './useTaskMutations';
import { drainQueue } from '../lib/offline-queue';

export function useOfflineSync(): void {
  const {
    createTask, updateTask, toggleTask, deleteTask,
    createList, updateList, deleteList,
  } = useTaskMutations();
  const { createSubtask, toggleSubtask, deleteSubtask } = useSubtaskMutations();
  const { createComment, deleteComment } = useCommentMutations();

  const execute = useCallback(
    async (m: QueuedMutation): Promise<void> => {
      const p = m.payload as Record<string, unknown>;
      const key = m.id;

      let result: { error?: unknown } | undefined | null;

      switch (m.type) {
        case 'create_task':
          result = await createTask(
            String(p['title'] ?? ''),
            key,
            typeof p['dueDate'] === 'string' ? p['dueDate'] : null,
          );
          break;
        case 'update_task':
          result = await updateTask(String(p['id']), (p['fields'] as Record<string, unknown>) ?? {}, key);
          break;
        case 'toggle_task':
          result = await toggleTask(String(p['id']), Boolean(p['completed']), key);
          break;
        case 'delete_task':
          result = await deleteTask(String(p['id']), key);
          break;
        case 'create_list':
          result = await createList(String(p['title'] ?? ''), (p['color'] as string) ?? undefined, key);
          break;
        case 'update_list':
          result = await updateList(String(p['id']), (p['fields'] as Record<string, unknown>) ?? {}, key);
          break;
        case 'delete_list':
          result = await deleteList(String(p['id']), key);
          break;
        case 'create_subtask':
          result = await createSubtask(String(p['todoId']), String(p['title'] ?? ''));
          break;
        case 'toggle_subtask':
          result = await toggleSubtask(String(p['id']), Boolean(p['isDone']));
          break;
        case 'delete_subtask':
          result = await deleteSubtask(String(p['id']));
          break;
        case 'create_comment':
          result = await createComment(String(p['todoId']), String(p['body'] ?? ''), key);
          break;
        case 'delete_comment':
          result = await deleteComment(String(p['id']));
          break;
        default:
          return; // Unknown type — drop silently
      }

      if (result && (result as { error?: unknown }).error) {
        throw new Error(String((result as { error?: unknown }).error));
      }
    },
    [
      createTask, updateTask, toggleTask, deleteTask,
      createList, updateList, deleteList,
      createSubtask, toggleSubtask, deleteSubtask,
      createComment, deleteComment,
    ],
  );

  const handleReconnect = useCallback(async () => {
    const { processed, failed } = await drainQueue(execute);
    if (failed > 0) {
      Alert.alert(
        'Some changes could not be synced',
        `${failed} queued change${failed > 1 ? 's' : ''} failed to sync and were discarded.`,
      );
    }
    void processed;
  }, [execute]);

  useNetworkState({ onReconnect: handleReconnect });
}
