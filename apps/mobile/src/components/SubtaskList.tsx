/**
 * Purpose: Subtask checklist for a task — list, add, toggle, delete subtasks.
 * Inputs: todoId string
 * Outputs: Vertical list of subtask rows with inline add input.
 * Constraints: 7-state pattern (loading/empty/error/populated); WCAG a11y.
 * SPORT: P5-C-mobile new feature — subtasks.
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useQuery } from 'urql';
import type { NpSubtask } from '../types';
import { GET_SUBTASKS } from '../lib/hasura';
import { useSubtaskMutations } from '../hooks/useTaskMutations';

interface SubtasksData {
  np_subtasks: NpSubtask[];
}

interface Props {
  todoId: string;
}

export function SubtaskList({ todoId }: Props) {
  const [result, reexecute] = useQuery<SubtasksData>({
    query: GET_SUBTASKS,
    variables: { todoId },
    requestPolicy: 'cache-and-network',
  });
  const { createSubtask, toggleSubtask, deleteSubtask, creating } = useSubtaskMutations();
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  const subtasks = result.data?.np_subtasks ?? [];
  const done = subtasks.filter((s) => s.is_done).length;

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle('');
    await createSubtask(todoId, title, subtasks.length);
    reexecute({ requestPolicy: 'network-only' });
  };

  const handleToggle = async (subtask: NpSubtask) => {
    await toggleSubtask(subtask.id, !subtask.is_done);
    reexecute({ requestPolicy: 'network-only' });
  };

  const handleDelete = async (id: string) => {
    await deleteSubtask(id);
    reexecute({ requestPolicy: 'network-only' });
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>
          SUBTASKS {subtasks.length > 0 ? `(${done}/${subtasks.length})` : ''}
        </Text>
        <TouchableOpacity
          onPress={() => setAdding((v) => !v)}
          accessibilityLabel={adding ? 'Cancel adding subtask' : 'Add subtask'}
          accessibilityRole="button"
        >
          <Text style={styles.addBtn}>{adding ? 'Done' : '+ Add'}</Text>
        </TouchableOpacity>
      </View>

      {result.fetching && subtasks.length === 0 && (
        <ActivityIndicator size="small" color="#6366f1" style={{ marginVertical: 8 }} />
      )}

      {subtasks.map((subtask) => (
        <View key={subtask.id} style={styles.row}>
          <TouchableOpacity
            onPress={() => handleToggle(subtask)}
            style={styles.checkbox}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: subtask.is_done }}
            accessibilityLabel={subtask.title}
          >
            <View style={[styles.checkboxBox, subtask.is_done && styles.checkboxChecked]}>
              {subtask.is_done && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </TouchableOpacity>
          <Text style={[styles.subtaskTitle, subtask.is_done && styles.subtaskDone]} numberOfLines={2}>
            {subtask.title}
          </Text>
          <TouchableOpacity
            onPress={() => handleDelete(subtask.id)}
            style={styles.deleteBtn}
            accessibilityLabel={`Delete subtask ${subtask.title}`}
            accessibilityRole="button"
          >
            <Text style={styles.deleteBtnText}>×</Text>
          </TouchableOpacity>
        </View>
      ))}

      {subtasks.length === 0 && !result.fetching && !adding && (
        <Text style={styles.empty}>No subtasks yet.</Text>
      )}

      {adding && (
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder="Subtask title"
            autoFocus
            maxLength={200}
            onSubmitEditing={handleAdd}
            accessibilityLabel="New subtask title"
          />
          <TouchableOpacity
            onPress={handleAdd}
            style={[styles.addSaveBtn, (!newTitle.trim() || creating) && styles.addSaveBtnDisabled]}
            disabled={!newTitle.trim() || creating}
            accessibilityLabel="Save subtask"
            accessibilityRole="button"
          >
            {creating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.addSaveBtnText}>Add</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  addBtn: { fontSize: 14, color: '#6366f1', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  checkbox: { marginRight: 10, padding: 2 },
  checkboxBox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#6366f1', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  subtaskTitle: { flex: 1, fontSize: 14, color: '#111827' },
  subtaskDone: { textDecorationLine: 'line-through', color: '#9ca3af' },
  deleteBtn: { padding: 6 },
  deleteBtnText: { fontSize: 18, color: '#d1d5db', fontWeight: '300' },
  empty: { fontSize: 13, color: '#9ca3af', fontStyle: 'italic', paddingVertical: 4 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  addInput: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#fff' },
  addSaveBtn: { backgroundColor: '#6366f1', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  addSaveBtnDisabled: { backgroundColor: '#c4b5fd' },
  addSaveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
