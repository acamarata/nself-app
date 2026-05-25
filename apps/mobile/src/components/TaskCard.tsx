/**
 * Purpose: Single task row with checkbox, priority indicator, due date, swipe-to-delete
 * Inputs: task Task, onToggle, onDelete, onPress callbacks
 * Outputs: Touchable row with priority dot + strikethrough when completed
 * Constraints: Priority color scheme matches Flutter _TaskItem._priorityColor
 * SPORT: Port of Flutter _TaskItem widget from list_screen.dart
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import type { Task, TaskPriority } from '../types';

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  none: 'transparent',
  low: '#9ca3af',
  medium: '#f59e0b',
  high: '#ef4444',
};

interface Props {
  task: Task;
  onToggle: (completed: boolean) => void;
  onDelete: () => void;
  onPress: () => void;
}

export function TaskCard({ task, onToggle, onDelete, onPress }: Props) {
  const dotColor = PRIORITY_COLORS[task.priority];

  const confirmDelete = () =>
    Alert.alert('Delete task', 'This task will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} onLongPress={confirmDelete} accessibilityLabel={task.title}>
      <View style={styles.leading}>
        {task.priority !== 'none' && (
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
        )}
        <TouchableOpacity
          onPress={() => onToggle(!task.completed)}
          style={styles.checkbox}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: task.completed }}
        >
          <View style={[styles.checkboxBox, task.completed && styles.checkboxChecked]}>
            {task.completed && <Text style={styles.checkmark}>✓</Text>}
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, task.completed && styles.titleDone]} numberOfLines={2}>
          {task.title}
        </Text>
        {task.due_date && (
          <Text style={styles.dueDate}>Due: {task.due_date.split('T')[0]}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  leading: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  checkbox: { padding: 4 },
  checkboxBox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: '#6366f1', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  content: { flex: 1 },
  title: { fontSize: 15, color: '#111827' },
  titleDone: { textDecorationLine: 'line-through', color: '#9ca3af' },
  dueDate: { fontSize: 12, color: '#6b7280', marginTop: 2 },
});
