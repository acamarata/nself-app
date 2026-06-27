/**
 * Purpose: Task detail/edit screen — fetches task by ID, allows editing title,
 *          completion, priority, due date, notes; shows subtasks + comments + tags.
 * SPORT: P5-C-mobile — rewired to np_todos, adds subtasks/comments/tags.
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Switch, Platform,
} from 'react-native';
import { useQuery } from 'urql';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, Priority } from '../types';
import { GET_TODO } from '../lib/hasura';
import { useTaskMutations } from '../hooks/useTaskMutations';
import { TaskStatus } from '../components/TaskStatus';
import { AssigneeSelector } from '../components/AssigneeSelector';
import { SubtaskList } from '../components/SubtaskList';
import { CommentThread } from '../components/CommentThread';
import { TagPicker } from '../components/TagPicker';

type Props = NativeStackScreenProps<RootStackParamList, 'TaskDetail'>;

interface TodoData {
  np_todos_by_pk: {
    id: string;
    title: string;
    description: string;
    completed: boolean;
    priority: Priority;
    notes: string;
    due_date: string | null;
    user_id: string;
  } | null;
}

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];
const PRIORITY_LABELS: Record<Priority, string> = {
  none: 'None', low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent',
};
const PRIORITY_HEX: Record<Priority, string> = {
  none: '#9ca3af', low: '#3b82f6', medium: '#f59e0b', high: '#f97316', urgent: '#ef4444',
};

export function TaskDetailScreen({ route, navigation }: Props) {
  const { taskId, listId } = route.params;

  const [result] = useQuery<TodoData>({
    query: GET_TODO,
    variables: { id: taskId },
    requestPolicy: 'cache-and-network',
  });

  const task = result.data?.np_todos_by_pk;
  const { updateTask, deleteTask } = useTaskMutations(listId);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [completed, setCompleted] = useState(false);
  const [priority, setPriority] = useState<Priority>('none');
  const [dueDate, setDueDate] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);

  if (task && !initialized) {
    setTitle(task.title);
    setNotes(task.notes ?? '');
    setCompleted(task.completed);
    setPriority(task.priority ?? 'none');
    setDueDate(task.due_date?.split('T')[0] ?? '');
    setInitialized(true);
  }

  const handleSave = async () => {
    if (saving || !task) return;
    setSaving(true);
    try {
      await updateTask(task.id, {
        title: title.trim() || task.title,
        description: notes.trim(),
        notes: notes.trim(),
        completed,
        priority,
        dueDate: dueDate || null,
      });
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () =>
    Alert.alert('Delete task', 'This task will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          if (!task) return;
          await deleteTask(task.id);
          navigation.goBack();
        },
      },
    ]);

  if (result.fetching && !task) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!task) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Task not found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Task</Text>
        <View style={styles.headerActions}>
          {saving ? (
            <ActivityIndicator color="#6366f1" />
          ) : (
            <TouchableOpacity onPress={handleSave} accessibilityLabel="Save">
              <Text style={styles.saveBtn}>Save</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleDelete} style={{ marginLeft: 16 }} accessibilityLabel="Delete task">
            <Text style={styles.deleteBtn}>🗑</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <TaskStatus priority={priority} completed={completed} />

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.inputLarge}
          value={title}
          onChangeText={setTitle}
          placeholder="Task title"
          multiline
          numberOfLines={2}
          accessibilityLabel="Task title"
        />

        <View style={styles.toggleRow}>
          <Text style={styles.label}>Completed</Text>
          <Switch
            value={completed}
            onValueChange={setCompleted}
            trackColor={{ true: '#6366f1' }}
            thumbColor={Platform.OS === 'android' ? (completed ? '#6366f1' : '#f4f4f5') : undefined}
            accessibilityLabel="Mark completed"
          />
        </View>

        <Text style={styles.label}>Priority</Text>
        <View style={styles.segmentRow}>
          {PRIORITIES.map((p) => (
            <TouchableOpacity
              key={p}
              style={[
                styles.segment,
                priority === p && { borderColor: PRIORITY_HEX[p], backgroundColor: `${PRIORITY_HEX[p]}18` },
              ]}
              onPress={() => setPriority(p)}
              accessibilityRole="button"
              accessibilityLabel={`Priority ${PRIORITY_LABELS[p]}`}
              accessibilityState={{ selected: priority === p }}
            >
              <Text style={[styles.segmentText, priority === p && { color: PRIORITY_HEX[p] }]}>
                {PRIORITY_LABELS[p]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Due date (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={dueDate}
          onChangeText={setDueDate}
          placeholder="e.g. 2025-12-31"
          keyboardType="numbers-and-punctuation"
          accessibilityLabel="Due date"
        />

        <AssigneeSelector assigneeId={null} readonly />

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add notes…"
          multiline
          numberOfLines={5}
          accessibilityLabel="Notes"
        />

        <SubtaskList todoId={task.id} />
        <TagPicker todoId={task.id} userId={task.user_id} />
        <CommentThread todoId={task.id} userId={task.user_id} />

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Save changes"
        >
          <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save changes'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  notFound: { fontSize: 16, color: '#6b7280', marginBottom: 16 },
  backBtn: { backgroundColor: '#6366f1', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  backBtnText: { color: '#fff', fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  back: { fontSize: 16, color: '#6366f1', width: 60 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  headerActions: { flexDirection: 'row', alignItems: 'center', width: 80, justifyContent: 'flex-end' },
  saveBtn: { fontSize: 15, color: '#6366f1', fontWeight: '700' },
  deleteBtn: { fontSize: 18 },
  body: { padding: 20, gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 6 },
  inputLarge: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 17, fontWeight: '600', backgroundColor: '#fff', minHeight: 56 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 15, backgroundColor: '#fff' },
  textarea: { minHeight: 100, textAlignVertical: 'top' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  segmentRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: '#d1d5db', alignItems: 'center', backgroundColor: '#fff', minWidth: 60 },
  segmentText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  saveButton: { backgroundColor: '#6366f1', borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 24 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
