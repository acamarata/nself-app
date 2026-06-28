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
  Alert, RefreshControl, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, NpTask } from '../types';
import { TaskCard } from '../components/TaskCard';
import { AddTaskModal } from '../components/AddTaskModal';
import {
  EmptyState, ErrorCard, OfflineBanner,
  PermissionDenied, RateLimitedCard, SkeletonList,
} from '../components/seven-states';
import { useTasks } from '../hooks/useTasks';
import { useTaskMutations } from '../hooks/useTaskMutations';
import { useNetworkState } from '../hooks/useNetworkState';
import { enqueue, queueSize } from '../lib/offline-queue';
import { generateIdempotencyKey } from '../lib/idempotency';
import { classifyUrqlError, taskUserMessage } from '../lib/task-error';
import { useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'List'>;

/** A task with an optional pending-optimistic flag */
interface DisplayTask extends NpTask {
  pending?: boolean;
}

/** Stub fields for an optimistic task before server round-trip. */
const OPTIMISTIC_DEFAULTS = {
  user_id: '',
  description: '',
  is_public: false,
  notes: '',
  due_date: null,
  source_account_id: 'primary',
  requires_approval: false,
  requires_photo: false,
  approved_by: null,
  approved_at: null,
  rejected_by: null,
  rejected_at: null,
  rejection_reason: null,
} as const;

export function ListScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const { listId, listTitle } = route.params;
  const { tasks, loading, error, refetch } = useTasks(listId);
  const { createTask, toggleTask, deleteTask } = useTaskMutations(listId);
  const [modalVisible, setModalVisible] = useState(false);
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

  const handleCreate = useCallback(async (title: string) => {
    const idempotencyKey = generateIdempotencyKey('create_task', `${listId}:${title}`);
    setModalVisible(false);

    if (isOffline) {
      // Offline path — enqueue and add to optimistic list
      const tempId = `pending-${Date.now()}`;
      const optimistic: DisplayTask = {
        ...OPTIMISTIC_DEFAULTS,
        id: tempId,
        title,
        completed: false,
        list_id: listId,
        position: displayTasks.length,
        priority: 'none',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        pending: true,
      };
      setOptimisticTasks((prev) => [...prev, optimistic]);
      void enqueue('create_task', { listId, title }, idempotencyKey);
      return;
    }

    // Online path — optimistic create
    const tempId = `optimistic-${Date.now()}`;
    const optimistic: DisplayTask = {
      ...OPTIMISTIC_DEFAULTS,
      id: tempId,
      title,
      completed: false,
      list_id: listId,
      position: displayTasks.length,
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
          { text: 'Retry', onPress: () => setModalVisible(true) },
        ]);
      } else {
        setOptimisticTasks((prev) => prev.filter((t) => t.id !== tempId));
        refetch();
      }
    } catch (e) {
      setOptimisticTasks((prev) => prev.filter((t) => t.id !== tempId));
      Alert.alert('Task not saved', 'An unexpected error occurred. Tap Retry to try again.', [
        { text: 'Dismiss', style: 'cancel' },
        { text: 'Retry', onPress: () => setModalVisible(true) },
      ]);
    }
  }, [listId, isOffline, displayTasks.length, createTask, refetch]);

  const renderTask = useCallback(
    ({ item }: { item: DisplayTask }) => (
      <TaskCard
        task={item}
        pending={item.pending}
        onToggle={(completed) => {
          if (isOffline) {
            void enqueue('toggle_task', { id: item.id, completed }, generateIdempotencyKey('toggle_task', `${item.id}:${String(completed)}`));
            return;
          }
          toggleTask(item.id, completed).then(() => refetch());
        }}
        onDelete={() => {
          if (isOffline) {
            void enqueue('delete_task', { id: item.id }, generateIdempotencyKey('delete_task', item.id));
            setOptimisticTasks((prev) => prev.filter((t) => t.id !== item.id));
            return;
          }
          deleteTask(item.id).then(() => refetch());
        }}
        onPress={() => navigation.navigate('TaskDetail', { taskId: item.id, listId })}
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
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.primary} />}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surfaceElevated, borderBottomColor: colors.borderSubtle }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <Text style={[styles.back, { color: colors.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{listTitle}</Text>
        <TouchableOpacity
          style={styles.membersBtn}
          onPress={() => navigation.navigate('ListMembers', {
            listId,
            listTitle,
            currentUserId: '', // filled from auth context in a future pass
            isOwner: false,    // conservative default
          })}
          accessibilityLabel="Manage members"
          accessibilityRole="button"
        >
          <Text style={styles.membersBtnText}>👥</Text>
        </TouchableOpacity>
      </View>

      {/* Offline banner (always at top when offline) */}
      <OfflineBanner visible={isOffline} queueLength={offlineQueueCount} />

      {/* Body — one of the 7 states */}
      <View style={styles.body}>
        {renderBody()}
      </View>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
        onPress={() => setModalVisible(true)}
        accessibilityLabel="Add task"
        accessibilityRole="button"
      >
        <Text style={[styles.fabText, { color: colors.textOnPrimary }]}>+</Text>
      </TouchableOpacity>

      <AddTaskModal
        visible={modalVisible}
        listId={listId}
        isOffline={isOffline}
        onSave={handleCreate}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

/**
 * Thin hook: wraps useNetworkState + wires queue flush on reconnect.
 * Returns isConnected + live queueLength count.
 */
function useQueueAwareNetwork(onReconnect: () => void) {
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  const handleReconnect = useCallback(() => {
    onReconnect();
    // Re-read queue length after sync attempt (actual drain handled by OfflineSyncDriver at app level)
    setTimeout(() => { void queueSize().then(setOfflineQueueCount); }, 500);
  }, [onReconnect]);

  const { isConnected } = useNetworkState({ onReconnect: handleReconnect });

  return { isConnected, queueLength: offlineQueueCount };
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 14, borderBottomWidth: 1 },
  back: { fontSize: 16, width: 60 },
  title: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  membersBtn: { width: 60, alignItems: 'flex-end', justifyContent: 'center' },
  membersBtnText: { fontSize: 20 },
  body: { flex: 1 },
  fab: { position: 'absolute', bottom: 32, right: 20, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6 },
  fabText: { fontSize: 28, lineHeight: 32 },
});
