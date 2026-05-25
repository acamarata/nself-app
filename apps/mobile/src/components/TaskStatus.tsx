/**
 * Purpose: Priority badge and completion status pill display component
 * Inputs: priority TaskPriority, completed boolean
 * Outputs: Inline pill badges for task detail header
 * Constraints: Visual-only; no interaction
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { TaskPriority } from '../types';

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  none: 'No priority',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  none: '#e5e7eb',
  low: '#d1d5db',
  medium: '#fef3c7',
  high: '#fee2e2',
};

interface Props {
  priority: TaskPriority;
  completed: boolean;
}

export function TaskStatus({ priority, completed }: Props) {
  return (
    <View style={styles.row}>
      <View style={[styles.badge, { backgroundColor: PRIORITY_COLORS[priority] }]}>
        <Text style={styles.badgeText}>{PRIORITY_LABELS[priority]}</Text>
      </View>
      <View style={[styles.badge, { backgroundColor: completed ? '#dcfce7' : '#f3f4f6' }]}>
        <Text style={styles.badgeText}>{completed ? 'Complete' : 'Incomplete'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, color: '#374151', fontWeight: '600' },
});
