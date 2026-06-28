/**
 * Purpose: Priority badge and completion status pill display component
 * Inputs: priority TaskPriority, completed boolean
 * Outputs: Inline pill badges for task detail header
 * Constraints: Visual-only; no interaction
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { TaskPriority } from '../types';
import { useTheme } from '../theme';

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  none: 'No priority',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

interface Props {
  priority: TaskPriority;
  completed: boolean;
}

export function TaskStatus({ priority, completed }: Props) {
  const { colors } = useTheme();

  const PRIORITY_COLORS: Record<TaskPriority, string> = {
    none: colors.border,
    low: colors.primarySubtle,
    medium: colors.warningSubtle,
    high: colors.dangerSubtle,
    urgent: colors.dangerSubtle,
  };

  return (
    <View
      style={styles.row}
      accessibilityRole="text"
      accessibilityLabel={`${priority}${completed ? ' complete' : ' incomplete'}`}
    >
      <View style={[styles.badge, { backgroundColor: PRIORITY_COLORS[priority] }]}>
        <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{PRIORITY_LABELS[priority]}</Text>
      </View>
      <View style={[styles.badge, { backgroundColor: completed ? colors.successSubtle : colors.surface }]}>
        <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{completed ? 'Complete' : 'Incomplete'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '600' },
});
