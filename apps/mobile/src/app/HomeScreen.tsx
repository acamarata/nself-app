/**
 * Purpose: Home screen — shows all task lists; create/rename/delete list actions; 7-state pattern
 * Inputs: urql GET_LISTS query; navigation to List screen on tap
 * Outputs: FlatList of TaskList cards with FAB; OfflineBanner; 7-state rendering
 * Constraints:
 *   - 7 states: loading | empty | error | populated | offline | permission-denied | rate-limited
 *   - Offline banner shown when isConnected=false; lists still displayed from urql cache
 *   - Replaces @apollo/client useQuery with urql useQuery per D-P3-REACT19 / E2 wiring.
 * SPORT: T-P3-E5-W3-S1-T01-b 7-state HomeScreen
 */

import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Alert, Modal, TextInput,
  RefreshControl,
} from 'react-native';
import { useQuery } from 'urql';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, NpList } from '../types';
import { GET_LISTS } from '../lib/hasura';
import { useTaskMutations } from '../hooks/useTaskMutations';
import { useNetworkState } from '../hooks/useNetworkState';
import {
  EmptyState, ErrorCard, OfflineBanner,
  PermissionDenied, RateLimitedCard, SkeletonList,
} from '../components/seven-states';
import { classifyUrqlError, taskUserMessage } from '../lib/task-error';
import { projectCreateSchema } from '../lib/validation';
import { enqueue } from '../lib/offline-queue';
import { generateIdempotencyKey } from '../lib/idempotency';
import { useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

interface ListsData { np_lists: NpList[] }

function parseColor(hex: string): string {
  // validate — fall back to indigo
  return /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : '#6366f1';
}

export function HomeScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [result, reexecuteQuery] = useQuery<ListsData>({
    query: GET_LISTS,
    requestPolicy: 'cache-and-network',
  });
  const { data, fetching: loading, error } = result;
  const refetch = () => reexecuteQuery({ requestPolicy: 'network-only' });
  const { createList, updateList, deleteList } = useTaskMutations();
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<NpList | null>(null);

  // Network state — OfflineBanner on all screens
  const { isConnected } = useNetworkState({ onReconnect: refetch });

  const openCreate = () => { setEditTarget(null); setModalTitle(''); setModalError(null); setModalVisible(true); };
  const openRename = (list: NpList) => { setEditTarget(list); setModalTitle(list.title); setModalError(null); setModalVisible(true); };

  const handleSave = async () => {
    if (editTarget) {
      const title = modalTitle.trim();
      if (!title) { setModalError('Name is required.'); return; }
      const listId = editTarget.id;
      setModalVisible(false);

      if (!isConnected) {
        // Offline path — enqueue and let OfflineSyncDriver replay on reconnect
        // (mirrors ListScreen's / TaskDetailScreen's offline handling).
        void enqueue('update_list', { id: listId, fields: { title } }, generateIdempotencyKey('update_list', listId));
        return;
      }

      try {
        const result = await updateList(listId, { title });
        if (result.error) {
          const taskErr = classifyUrqlError(result.error);
          Alert.alert('List not saved', taskUserMessage(taskErr));
          return;
        }
      } catch {
        Alert.alert('List not saved', 'An unexpected error occurred. Please try again.');
        return;
      }
    } else {
      const validation = projectCreateSchema({ title: modalTitle });
      if (!validation.success) { setModalError(validation.errors?.[0]?.message ?? 'Invalid input'); return; }
      const title = validation.data!.title;
      setModalVisible(false);

      if (!isConnected) {
        void enqueue('create_list', { title }, generateIdempotencyKey('create_list', `${title}:${Date.now()}`));
        return;
      }

      try {
        const result = await createList(title);
        if (result.error) {
          const taskErr = classifyUrqlError(result.error);
          Alert.alert('List not saved', taskUserMessage(taskErr));
          return;
        }
      } catch {
        Alert.alert('List not saved', 'An unexpected error occurred. Please try again.');
        return;
      }
    }
    refetch();
  };

  const confirmDelete = (list: NpList) =>
    Alert.alert('Delete list', `"${list.title}" and all its tasks will be deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          if (!isConnected) {
            void enqueue('delete_list', { id: list.id }, generateIdempotencyKey('delete_list', list.id));
            return;
          }
          try {
            const result = await deleteList(list.id);
            if (result.error) {
              const taskErr = classifyUrqlError(result.error);
              Alert.alert('List not deleted', taskUserMessage(taskErr));
              return;
            }
          } catch {
            Alert.alert('List not deleted', 'An unexpected error occurred. Please try again.');
            return;
          }
          refetch();
        },
      },
    ]);

  const lists = data?.np_lists ?? [];

  // Determine 7-state
  const renderBody = () => {
    if (loading && lists.length === 0) return <SkeletonList rows={6} rowHeight={72} />;
    if (error) {
      const taskErr = classifyUrqlError(error);
      if (taskErr.type === 'auth') return <PermissionDenied />;
      if (taskErr.type === 'rate_limit') return <RateLimitedCard retryAfter={taskErr.retryAfter ?? 30} onRetry={refetch} />;
      return <ErrorCard message={taskUserMessage(taskErr)} onRetry={refetch} />;
    }
    if (lists.length === 0) {
      return (
        <EmptyState
          icon="✅"
          title="No lists yet"
          hint="Tap + to create your first list"
          actionLabel="New list"
          onAction={openCreate}
        />
      );
    }
    return (
      <FlatList
        data={lists}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.surfaceElevated, shadowColor: colors.shadow }]}
            onPress={() => navigation.navigate('List', { listId: item.id, listTitle: item.title })}
            onLongPress={() => Alert.alert(item.title, undefined, [
              { text: 'Rename', onPress: () => openRename(item) },
              { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(item) },
              { text: 'Cancel', style: 'cancel' },
            ])}
            accessibilityLabel={item.title}
            accessibilityRole="button"
          >
            <View style={[styles.colorDot, { backgroundColor: parseColor(item.color) }]} />
            <View style={styles.cardContent}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
              {item.description ? <Text style={[styles.cardDesc, { color: colors.textTertiary }]} numberOfLines={1}>{item.description}</Text> : null}
            </View>
            <Text style={[styles.chevron, { color: colors.border }]}>›</Text>
          </TouchableOpacity>
        )}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surfaceElevated, borderBottomColor: colors.borderSubtle }]}>
        <Text style={[styles.headerTitle, { color: colors.primary }]}>ɳTask</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => navigation.navigate('SmartView')}
            accessibilityLabel="Smart views"
            accessibilityRole="button"
            style={styles.headerIcon}
          >
            <Text style={styles.headerIconText}>🗓️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('SavedViews')}
            accessibilityLabel="Saved views"
            accessibilityRole="button"
            style={styles.headerIcon}
          >
            <Text style={styles.headerIconText}>🔖</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            accessibilityLabel="Settings"
            accessibilityRole="button"
            style={styles.headerIcon}
          >
            <Text style={styles.headerIconText}>⚙️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            accessibilityLabel="Profile"
            accessibilityRole="button"
            style={styles.headerIcon}
          >
            <Text style={styles.headerIconText}>👤</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Offline banner */}
      <OfflineBanner visible={!isConnected} />

      {/* 7-state body */}
      <View style={styles.body}>
        {renderBody()}
      </View>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
        onPress={openCreate}
        accessibilityLabel="New list"
        accessibilityRole="button"
      >
        <Text style={[styles.fabText, { color: colors.textOnPrimary }]}>+ New list</Text>
      </TouchableOpacity>

      {/* Create / rename modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: colors.surfaceElevated }]} accessibilityViewIsModal={true}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{editTarget ? 'Rename list' : 'New list'}</Text>
            <TextInput
              style={[styles.modalInput, { borderColor: modalError ? colors.danger : colors.border }]}
              value={modalTitle}
              onChangeText={(t) => { setModalTitle(t); setModalError(null); }}
              placeholder="List name"
              autoFocus
              maxLength={100}
              accessibilityLabel="List name"
            />
            {!!modalError && <Text style={[styles.validationError, { color: colors.danger }]}>{modalError}</Text>}
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setModalVisible(false)} accessibilityRole="button" accessibilityLabel="Cancel">
                <Text style={[styles.modalCancel, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} accessibilityRole="button" accessibilityLabel={editTarget ? 'Save list name' : 'Create list'}>
                <Text style={[styles.modalSave, { color: colors.primary }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: { padding: 6 },
  headerIconText: { fontSize: 20 },
  body: { flex: 1 },
  listContent: { padding: 16, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 16, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  colorDot: { width: 40, height: 40, borderRadius: 10, marginRight: 16 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  cardDesc: { fontSize: 12, marginTop: 2 },
  chevron: { fontSize: 22 },
  fab: { position: 'absolute', bottom: 32, right: 20, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 28, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6 },
  fabText: { fontSize: 15, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 32 },
  modal: { borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 16 },
  modalInput: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 8 },
  validationError: { fontSize: 12, marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20, marginTop: 12 },
  modalCancel: { fontSize: 15 },
  modalSave: { fontSize: 15, fontWeight: '700' },
});
