/**
 * Purpose: Task list screen — 7-state pattern, FlashList, optimistic mutations, offline support
 * Inputs: listId + listTitle from navigation params; urql GET_TASKS query
 * Outputs: FlashList of TaskCard rows with 7-state rendering; FAB to add task
 * Constraints:
 *   - 7 states: loading | empty | error | populated | offline | permission-denied | rate-limited
 *   - FlashList (Shopify) with estimatedItemSize=60 for smooth 200+ item rendering
 *   - Optimistic create: task appended with pending=true; removed on error + retry toast
 *   - Offline: mutations enqueued; OfflineBanner shown; locally cached tasks visible
 *   - Idempotency: idempotencyKey per create mutation; server deduplication on retry
 * SPORT: T-P3-E5-W3-S1-T01-b — replaces FlatList, adds 7-state + offline
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert, Modal, RefreshControl, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, Task } from '../types';
import { TaskCard } from '../components/TaskCard';
import {
  EmptyState, ErrorCard, OfflineBanner,
  PermissionDenied, RateLimitedCard, SkeletonList,
} from '../components/seven-states';
import { useTasks } from '../hooks/useTasks';
import { useTaskMutations } from '../hooks/useTaskMutations';
import { useNetworkState } from '../hooks/useNetworkState';
import { enqueue, queueLength } from '../lib/offline-queue';
import { generateIdempotencyKey } from '../lib/idempotency';
import { taskCreateSchema } from '../lib/validation';
import { classifyUrqlError, taskUserMessage } from '../lib/task-error';

type Props = NativeStackScreenProps<RootStackParamList, 'List'>;

/** A task with an optional pending-optimistic flag */
interface DisplayTask extends Task {
  pending?: boolean;
}

export function ListScreen({ route, navigation }: Props) {
  const { listId, listTitle } = route.params;
  const { tasks, loading, error, refetch } = useTasks(listId);
  const { createTask, toggleTask, deleteTask } = useTaskMutations(listId);
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [optimisticTasks, setOptimisticTasks] = useState<DisplayTask[]>([]);

  // Network state — triggers queue flush on reconnect
  const { isConnected, queueLength: offlineQueueCount } = useQueueAwareNetwork(refetch);
  const isOffline = !isConnected;

  // Merge server tasks + optimistic pending tasks
  const displayTasks = useMemo<DisplayTask[]>(() => {
    const serverIds = new Set(tasks.map((t) => t.id));
    const pending = optimisticTasks.filter((t) => !serverIds.has(t.id));
    return [...tasks, ...pending];
  }, [tasks, optimisticTasks]);

  const handleCreate = useCallback(async () => {
    const validation = taskCreateSchema({ title: newTitle, listId });
    if (!validation.success) {
      setValidationError(validation.errors?.[0]?.message ?? 'Invalid input');
      return;
    }
    const title = validation.data!.title;
    const idempotencyKey = generateIdempotencyKey('create_task', `${listId}:${title}`);
    setModalVisible(false);
    setNewTitle('');
    setValidationError(null);

    if (isOffline) {
      // Offline path — enqueue and add to optimistic list
      const tempId = `pending-${Date.now()}`;
      const optimistic: DisplayTask = {
        id: tempId,
        title,
        completed: false,
        list_id: listId,
        position: displayTasks.length,
        tags: [],
        priority: 'none',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        pending: true,
      };
      setOptimisticTasks((prev) => [...prev, optimistic]);
      enqueue({
        type: 'create_task',
        payload: { listId, title },
        idempotencyKey,
      });
      return;
    }

    // Online path — optimistic create
    const tempId = `optimistic-${Date.now()}`;
    const optimistic: DisplayTask = {
      id: tempId,
      title,
      completed: false,
      list_id: listId,
      position: displayTasks.length,
      tags: [],
      priority: 'none',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      pending: true,
    };
    setOptimisticTasks((prev) => [...prev, optimistic]);

    try {
      const result = await createTask(title, idempotencyKey);
      if (result.error) {
        // Rollback on failure
        setOptimisticTasks((prev) => prev.filter((t) => t.id !== tempId));
        const taskErr = classifyUrqlError(result.error);
        Alert.alert('Task not saved', `${taskUserMessage(taskErr)}\n\nTap Retry to try again.`, [
          { text: 'Dismiss', style: 'cancel' },
          { text: 'Retry', onPress: () => { setNewTitle(title); setModalVisible(true); } },
        ]);
      } else {
        setOptimisticTasks((prev) => prev.filter((t) => t.id !== tempId));
        refetch();
      }
    } catch (e) {
      setOptimisticTasks((prev) => prev.filter((t) => t.id !== tempId));
      Alert.alert('Task not saved', 'An unexpected error occurred. Tap Retry to try again.', [
        { text: 'Dismiss', style: 'cancel' },
        { text: 'Retry', onPress: () => { setNewTitle(title); setModalVisible(true); } },
      ]);
    }
  }, [newTitle, listId, isOffline, displayTasks.length, createTask, refetch]);

  const renderTask = useCallback(
    ({ item }: { item: DisplayTask }) => (
      <TaskCard
        task={item}
        pending={item.pending}
        onToggle={(completed) => {
          if (isOffline) {
            enqueue({
              type: 'toggle_task',
              payload: { id: item.id, completed },
              idempotencyKey: generateIdempotencyKey('toggle_task', `${item.id}:${String(completed)}`),
            });
            return;
          }
          toggleTask(item.id, completed).then(() => refetch());
        }}
        onDelete={() => {
          if (isOffline) {
            enqueue({
              type: 'delete_task',
              payload: { id: item.id },
              idempotencyKey: generateIdempotencyKey('delete_task', item.id),
            });
            setOptimisticTasks((prev) => prev.filter((t) => t.id !== item.id));
            return;
          }
          deleteTask(item.id).then(() => refetch());
        }}
        onPress={() => navigation.navigate('TaskDetail', { task: item, listId })}
      />
    ),
    [isOffline, toggleTask, deleteTask, refetch, navigation, listId],
  );

  // Determine which state to render (7 states)
  const renderBody = () => {
    if (loading && displayTasks.length === 0) {
      return <SkeletonList rows={10} rowHeight={60} />;
    }
    if (error) {
      const taskErr = classifyUrqlError(error);
      if (taskErr.type === 'auth') {
        return <PermissionDenied />;
      }
      if (taskErr.type === 'rate_limit') {
        return <RateLimitedCard retryAfter={taskErr.retryAfter ?? 30} onRetry={refetch} />;
      }
      return <ErrorCard message={taskUserMessage(taskErr)} onRetry={refetch} />;
    }
    if (displayTasks.length === 0) {
      return (
        <EmptyState
          title="No tasks yet"
          hint="Tap + to create your first task"
          actionLabel="Add task"
          onAction={() => setModalVisible(true)}
        />
      );
    }
    // Populated state (includes offline with cached tasks)
    return (
      <FlashList
        data={displayTasks}
        keyExtractor={(t: DisplayTask) => t.id}
        estimatedItemSize={60}
        renderItem={renderTask}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor="#6366f1" />}
      />
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{listTitle}</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Offline banner (always at top when offline) */}
      <OfflineBanner visible={isOffline} queueLength={offlineQueueCount} />

      {/* Body — one of the 7 states */}
      <View style={styles.body}>
        {renderBody()}
      </View>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        accessibilityLabel="Add task"
        accessibilityRole="button"
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal} accessibilityViewIsModal={true}>
            <Text style={styles.modalTitle}>New task</Text>
            <TextInput
              style={[styles.modalInput, !!validationError && styles.modalInputError]}
              value={newTitle}
              onChangeText={(t) => { setNewTitle(t); setValidationError(null); }}
              placeholder="Task title"
              autoFocus
              maxLength={200}
              onSubmitEditing={handleCreate}
              accessibilityLabel="Task title"
            />
            {!!validationError && <Text style={styles.validationError}>{validationError}</Text>}
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => { setModalVisible(false); setNewTitle(''); setValidationError(null); }} accessibilityRole="button" accessibilityLabel="Cancel">
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreate} accessibilityRole="button" accessibilityLabel={isOffline ? 'Save task (queued for offline sync)' : 'Save task'}>
                <Text style={styles.modalSave}>{isOffline ? 'Save (offline)' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/**
 * Thin hook: wraps useNetworkState + wires queue flush on reconnect.
 * Returns isConnected + live queueLength count.
 */
function useQueueAwareNetwork(onReconnect: () => void) {
  const [offlineQueueCount, setOfflineQueueCount] = useState(queueLength());

  const handleReconnect = useCallback(() => {
    onReconnect();
    // Re-read queue length after sync attempt (actual drain handled by OfflineSyncDriver at app level)
    setTimeout(() => setOfflineQueueCount(queueLength()), 500);
  }, [onReconnect]);

  const { isConnected } = useNetworkState({ onReconnect: handleReconnect });

  return { isConnected, queueLength: offlineQueueCount };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  back: { fontSize: 16, color: '#6366f1', width: 60 },
  title: { fontSize: 17, fontWeight: '700', color: '#111827', flex: 1, textAlign: 'center' },
  body: { flex: 1 },
  fab: { position: 'absolute', bottom: 32, right: 20, backgroundColor: '#6366f1', width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6 },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 32 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 32 },
  modal: { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 16 },
  modalInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 8 },
  modalInputError: { borderColor: '#dc2626' },
  validationError: { fontSize: 12, color: '#dc2626', marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20, marginTop: 12 },
  modalCancel: { fontSize: 15, color: '#6b7280' },
  modalSave: { fontSize: 15, color: '#6366f1', fontWeight: '700' },
});
