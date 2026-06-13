/**
 * Purpose: Home screen — shows all task lists; create/rename/delete list actions
 * Inputs: Apollo GET_LISTS query; navigation to List screen on tap
 * Outputs: FlatList of TaskList cards with FAB to create list
 * Constraints: Pull-to-refresh; mirrors Flutter HomeScreen behavior
 * SPORT: Port of app/lib/screens/home_screen.dart
 */

import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Alert, Modal, TextInput,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useQuery } from '@apollo/client';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, TaskList } from '../types';
import { GET_LISTS } from '../lib/hasura';
import { useTaskMutations } from '../hooks/useTaskMutations';
import { useAuth } from '../hooks/useAuth';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

interface ListsData { app_lists: TaskList[] }

function parseColor(hex: string): string {
  // validate — fall back to indigo
  return /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : '#6366f1';
}

export function HomeScreen({ navigation }: Props) {
  const { signOut } = useAuth();
  const { data, loading, refetch } = useQuery<ListsData>(GET_LISTS, { fetchPolicy: 'cache-and-network' });
  const { createList, updateList, deleteList } = useTaskMutations();
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [editTarget, setEditTarget] = useState<TaskList | null>(null);

  const openCreate = () => { setEditTarget(null); setModalTitle(''); setModalVisible(true); };
  const openRename = (list: TaskList) => { setEditTarget(list); setModalTitle(list.title); setModalVisible(true); };

  const handleSave = async () => {
    const title = modalTitle.trim();
    if (!title) return;
    setModalVisible(false);
    if (editTarget) {
      await updateList(editTarget.id, { title });
    } else {
      await createList(title);
    }
    refetch();
  };

  const confirmDelete = (list: TaskList) =>
    Alert.alert('Delete list', `"${list.title}" and all its tasks will be deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteList(list.id); refetch(); } },
    ]);

  const lists = data?.app_lists ?? [];

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

      {loading && lists.length === 0 ? (
        <ActivityIndicator style={styles.center} color="#6366f1" />
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={lists.length === 0 ? styles.emptyContainer : styles.listContent}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>✅</Text>
              <Text style={styles.emptyTitle}>No lists yet</Text>
              <Text style={styles.emptyHint}>Tap + to create your first list</Text>
            </View>
          }
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
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openCreate} accessibilityLabel="New list" accessibilityRole="button">
        <Text style={styles.fabText}>+ New list</Text>
      </TouchableOpacity>

      {/* Create / rename modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{editTarget ? 'Rename list' : 'New list'}</Text>
            <TextInput
              style={styles.modalInput}
              value={modalTitle}
              onChangeText={setModalTitle}
              placeholder="List name"
              autoFocus
              accessibilityLabel="List name"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave}>
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
  center: { flex: 1 },
  listContent: { padding: 16, gap: 10 },
  emptyContainer: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 120 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#374151', marginBottom: 8 },
  emptyHint: { fontSize: 14, color: '#9ca3af' },
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
  modalInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 20 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20 },
  modalCancel: { fontSize: 15, color: '#6b7280' },
  modalSave: { fontSize: 15, color: '#6366f1', fontWeight: '700' },
});
