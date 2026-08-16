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
import { enqueue } from '../lib/offline-queue';
import { generateIdempotencyKey } from '../lib/idempotency';
import { useTheme } from '../theme';

interface SubtasksData {
  np_subtasks: NpSubtask[];
}

interface Props {
  todoId: string;
  /** When true, mutations enqueue via the offline-queue instead of hitting the network. */
  isOffline: boolean;
}

export function SubtaskList({ todoId, isOffline }: Props) {
  const { colors } = useTheme();
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

    if (isOffline) {
      void enqueue(
        'create_subtask',
        { todoId, title, position: subtasks.length },
        generateIdempotencyKey('create_subtask', `${todoId}:${title}:${Date.now()}`),
      );
      return;
    }
    await createSubtask(todoId, title, subtasks.length);
    reexecute({ requestPolicy: 'network-only' });
  };

  const handleToggle = async (subtask: NpSubtask) => {
    const isDone = !subtask.is_done;
    if (isOffline) {
      void enqueue(
        'toggle_subtask',
        { id: subtask.id, isDone },
        generateIdempotencyKey('toggle_subtask', `${subtask.id}:${String(isDone)}`),
      );
      return;
    }
    await toggleSubtask(subtask.id, isDone);
    reexecute({ requestPolicy: 'network-only' });
  };

  const handleDelete = async (id: string) => {
    if (isOffline) {
      void enqueue('delete_subtask', { id }, generateIdempotencyKey('delete_subtask', id));
      return;
    }
    await deleteSubtask(id);
    reexecute({ requestPolicy: 'network-only' });
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          SUBTASKS {subtasks.length > 0 ? `(${done}/${subtasks.length})` : ''}
        </Text>
        <TouchableOpacity
          onPress={() => setAdding((v) => !v)}
          accessibilityLabel={adding ? 'Cancel adding subtask' : 'Add subtask'}
          accessibilityRole="button"
        >
          <Text style={[styles.addBtn, { color: colors.primary }]}>{adding ? 'Done' : '+ Add'}</Text>
        </TouchableOpacity>
      </View>

      {result.fetching && subtasks.length === 0 && (
        <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 8 }} />
      )}

      {subtasks.map((subtask) => (
        <View key={subtask.id} style={[styles.row, { borderBottomColor: colors.borderSubtle }]}>
          <TouchableOpacity
            onPress={() => handleToggle(subtask)}
            style={styles.checkbox}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: subtask.is_done }}
            accessibilityLabel={subtask.title}
          >
            <View style={[styles.checkboxBox, { borderColor: colors.primary }, subtask.is_done && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
              {subtask.is_done && <Text style={[styles.checkmark, { color: colors.textOnPrimary }]}>✓</Text>}
            </View>
          </TouchableOpacity>
          <Text style={[styles.subtaskTitle, { color: colors.text }, subtask.is_done && { textDecorationLine: 'line-through', color: colors.textDisabled }]} numberOfLines={2}>
            {subtask.title}
          </Text>
          <TouchableOpacity
            onPress={() => handleDelete(subtask.id)}
            style={styles.deleteBtn}
            accessibilityLabel={`Delete subtask ${subtask.title}`}
            accessibilityRole="button"
          >
            <Text style={[styles.deleteBtnText, { color: colors.border }]}>×</Text>
          </TouchableOpacity>
        </View>
      ))}

      {subtasks.length === 0 && !result.fetching && !adding && (
        <Text style={[styles.empty, { color: colors.textTertiary }]}>No subtasks yet.</Text>
      )}

      {adding && (
        <View style={styles.addRow}>
          <TextInput
            style={[styles.addInput, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
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
            style={[styles.addSaveBtn, { backgroundColor: colors.primary }, (!newTitle.trim() || creating) && styles.addSaveBtnDisabled]}
            disabled={!newTitle.trim() || creating}
            accessibilityLabel="Save subtask"
            accessibilityRole="button"
          >
            {creating ? (
              <ActivityIndicator size="small" color={colors.textOnPrimary} />
            ) : (
              <Text style={[styles.addSaveBtnText, { color: colors.textOnPrimary }]}>Add</Text>
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
  sectionLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  addBtn: { fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  checkbox: { marginRight: 10, padding: 2 },
  checkboxBox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkmark: { fontSize: 12, fontWeight: '700' },
  subtaskTitle: { flex: 1, fontSize: 14 },
  deleteBtn: { padding: 6 },
  deleteBtnText: { fontSize: 18, fontWeight: '300' },
  empty: { fontSize: 13, fontStyle: 'italic', paddingVertical: 4 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  addInput: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14 },
  addSaveBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  addSaveBtnDisabled: { opacity: 0.5 },
  addSaveBtnText: { fontWeight: '700', fontSize: 14 },
});
