/**
 * Purpose: Task detail/edit screen — title, completion, priority, due date, notes, assignee
 * Inputs: task + listId from navigation params; Apollo UPDATE_TASK mutation
 * Outputs: Editable form; saves on "Save" press; delete with confirm dialog
 * Constraints: All fields match Flutter TaskDetailScreen; priority uses segment control pattern
 * SPORT: Port of app/lib/screens/task_detail_screen.dart
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Switch, Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, TaskPriority } from '../types';
import { useTaskMutations } from '../hooks/useTaskMutations';
import { TaskStatus } from '../components/TaskStatus';
import { AssigneeSelector } from '../components/AssigneeSelector';

type Props = NativeStackScreenProps<RootStackParamList, 'TaskDetail'>;

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high'];
const PRIORITY_LABELS: Record<TaskPriority, string> = { none: 'None', low: 'Low', medium: 'Medium', high: 'High' };

export function TaskDetailScreen({ route, navigation }: Props) {
  const { task, listId } = route.params;
  const { updateTask, deleteTask } = useTaskMutations(listId);

  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.description ?? '');
  const [completed, setCompleted] = useState(task.completed);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [dueDate, setDueDate] = useState(task.due_date?.split('T')[0] ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updateTask(task.id, {
        title: title.trim() || task.title,
        description: notes.trim(),
        completed,
        priority,
        due_date: dueDate || null,
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
          await deleteTask(task.id);
          navigation.goBack();
        },
      },
    ]);

  return (
    <View style={styles.container}>
      {/* Header */}
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
        {/* Status badges */}
        <TaskStatus priority={priority} completed={completed} />

        {/* Title */}
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

        {/* Completed toggle */}
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

        {/* Priority segments */}
        <Text style={styles.label}>Priority</Text>
        <View style={styles.segmentRow}>
          {PRIORITIES.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.segment, priority === p && styles.segmentActive]}
              onPress={() => setPriority(p)}
              accessibilityRole="button"
              accessibilityLabel={`Priority ${PRIORITY_LABELS[p]}`}
              accessibilityState={{ selected: priority === p }}
            >
              <Text style={[styles.segmentText, priority === p && styles.segmentTextActive]}>
                {PRIORITY_LABELS[p]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Due date */}
        <Text style={styles.label}>Due date (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={dueDate}
          onChangeText={setDueDate}
          placeholder="e.g. 2025-12-31"
          keyboardType="numbers-and-punctuation"
          accessibilityLabel="Due date"
        />

        {/* Assignee */}
        <AssigneeSelector assigneeId={task.assignee_id} readonly />

        {/* Notes */}
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

        {/* Save button */}
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
  segmentRow: { flexDirection: 'row', gap: 8 },
  segment: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, borderColor: '#d1d5db', alignItems: 'center', backgroundColor: '#fff' },
  segmentActive: { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  segmentText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  segmentTextActive: { color: '#6366f1' },
  saveButton: { backgroundColor: '#6366f1', borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 24 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
