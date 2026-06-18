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
import type { RootStackParamList, TaskList } from '../types';
import { GET_LISTS } from '../lib/hasura';
import { useTaskMutations } from '../hooks/useTaskMutations';
import { useAuth } from '../hooks/useAuth';
import { useNetworkState } from '../hooks/useNetworkState';
import {
  EmptyState, ErrorCard, OfflineBanner,
  PermissionDenied, RateLimitedCard, SkeletonList,
} from '../components/seven-states';
import { classifyUrqlError, taskUserMessage } from '../lib/task-error';
import { projectCreateSchema } from '../lib/validation';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

interface ListsData { app_lists: TaskList[] }

function parseColor(hex: string): string {
  // validate — fall back to indigo
  return /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : '#6366f1';
}

export function HomeScreen({ navigation }: Props) {
  const { signOut } = useAuth();
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
  const [editTarget, setEditTarget] = useState<TaskList | null>(null);

  // Network state — OfflineBanner on all screens
  const { isConnected } = useNetworkState({ onReconnect: refetch });

  const openCreate = () => { setEditTarget(null); setModalTitle(''); setModalError(null); setModalVisible(true); };
  const openRename = (list: TaskList) => { setEditTarget(list); setModalTitle(list.title); setModalError(null); setModalVisible(true); };

  const handleSave = async () => {
    if (editTarget) {
      const title = modalTitle.trim();
      if (!title) { setModalError('Name is required.'); return; }
      setModalVisible(false);
      await updateList(editTarget.id, { title });
    } else {
      const validation = projectCreateSchema({ title: modalTitle });
      if (!validation.success) { setModalError(validation.errors?.[0]?.message ?? 'Invalid input'); return; }
      setModalVisible(false);
      await createList(validation.data!.title);
    }
    refetch();
  };

  const confirmDelete = (list: TaskList) =>
    Alert.alert('Delete list', `"${list.title}" and all its tasks will be deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteList(list.id); refetch(); } },
    ]);

  const lists = data?.app_lists ?? [];

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
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor="#6366f1" />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
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
              <Text style={styles.cardTitle}>{item.title}</Text>
              {item.description ? <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text> : null}
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}
      />
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ɳTask</Text>
        <TouchableOpacity onPress={() => Alert.alert('Sign out', 'Are you sure?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign out', style: 'destructive', onPress: signOut },
        ])} accessibilityLabel="Sign out">
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {/* Offline banner */}
      <OfflineBanner visible={!isConnected} />

      {/* 7-state body */}
      <View style={styles.body}>
        {renderBody()}
      </View>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openCreate} accessibilityLabel="New list" accessibilityRole="button">
        <Text style={styles.fabText}>+ New list</Text>
      </TouchableOpacity>

      {/* Create / rename modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal} accessibilityViewIsModal={true}>
            <Text style={styles.modalTitle}>{editTarget ? 'Rename list' : 'New list'}</Text>
            <TextInput
              style={[styles.modalInput, !!modalError && styles.modalInputError]}
              value={modalTitle}
              onChangeText={(t) => { setModalTitle(t); setModalError(null); }}
              placeholder="List name"
              autoFocus
              maxLength={100}
              accessibilityLabel="List name"
            />
            {!!modalError && <Text style={styles.validationError}>{modalError}</Text>}
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setModalVisible(false)} accessibilityRole="button" accessibilityLabel="Cancel">
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} accessibilityRole="button" accessibilityLabel={editTarget ? 'Save list name' : 'Create list'}>
                <Text style={styles.modalSave}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#6366f1' },
  signOut: { fontSize: 14, color: '#6b7280' },
  body: { flex: 1 },
  listContent: { padding: 16, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  colorDot: { width: 40, height: 40, borderRadius: 10, marginRight: 16 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  cardDesc: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  chevron: { fontSize: 22, color: '#d1d5db' },
  fab: { position: 'absolute', bottom: 32, right: 20, backgroundColor: '#6366f1', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 28, shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6 },
  fabText: { color: '#fff', fontSize: 15, fontWeight: '700' },
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
