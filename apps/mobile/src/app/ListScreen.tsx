/**
 * Purpose: Task list screen — shows tasks in a list; create/toggle/delete/assign tasks
 * Inputs: listId + listTitle from navigation params; Apollo GET_TASKS query
 * Outputs: Scrollable task list with TaskCard rows, FAB to add task
 * Constraints: Pull-to-refresh; mirrors Flutter ListScreen behavior
 * SPORT: Port of app/lib/screens/list_screen.dart
 */

import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Modal, TextInput, RefreshControl, ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { TaskCard } from '../components/TaskCard';
import { useTasks } from '../hooks/useTasks';
import { useTaskMutations } from '../hooks/useTaskMutations';

type Props = NativeStackScreenProps<RootStackParamList, 'List'>;

export function ListScreen({ route, navigation }: Props) {
  const { listId, listTitle } = route.params;
  const { tasks, loading, refetch } = useTasks(listId);
  const { createTask, toggleTask, deleteTask } = useTaskMutations(listId);
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setModalVisible(false);
    setNewTitle('');
    await createTask(title);
    refetch();
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

      {loading && tasks.length === 0 ? (
        <ActivityIndicator style={styles.center} color="#6366f1" />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(t) => t.id}
          contentContainerStyle={tasks.length === 0 ? styles.emptyContainer : undefined}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No tasks yet</Text>
              <Text style={styles.emptyHint}>Tap + to add your first task</Text>
              <TouchableOpacity style={styles.emptyButton} onPress={() => setModalVisible(true)}>
                <Text style={styles.emptyButtonText}>Add task</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <TaskCard
              task={item}
              onToggle={(completed) => { toggleTask(item.id, completed).then(() => refetch()); }}
              onDelete={() => { deleteTask(item.id).then(() => refetch()); }}
              onPress={() => navigation.navigate('TaskDetail', { task: item, listId })}
            />
          )}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)} accessibilityLabel="Add task" accessibilityRole="button">
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>New task</Text>
            <TextInput
              style={styles.modalInput}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Task title"
              autoFocus
              onSubmitEditing={handleCreate}
              accessibilityLabel="Task title"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => { setModalVisible(false); setNewTitle(''); }}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreate}>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  back: { fontSize: 16, color: '#6366f1', width: 60 },
  title: { fontSize: 17, fontWeight: '700', color: '#111827', flex: 1, textAlign: 'center' },
  center: { flex: 1 },
  emptyContainer: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 120 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#374151', marginBottom: 8 },
  emptyHint: { fontSize: 14, color: '#9ca3af', marginBottom: 24 },
  emptyButton: { backgroundColor: '#6366f1', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 8 },
  emptyButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  fab: { position: 'absolute', bottom: 32, right: 20, backgroundColor: '#6366f1', width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6 },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 32 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 32 },
  modal: { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 16 },
  modalInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 20 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20 },
  modalCancel: { fontSize: 15, color: '#6b7280' },
  modalSave: { fontSize: 15, color: '#6366f1', fontWeight: '700' },
});
