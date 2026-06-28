/**
 * Purpose: Single task row with checkbox, priority indicator, due date; pending state support
 * Inputs: task Task, onToggle, onDelete, onPress callbacks; pending bool for optimistic rows
 * Outputs: Touchable row with priority dot + strikethrough when completed; faded when pending
 * Constraints:
 *   - Priority color scheme matches Flutter _TaskItem._priorityColor
 *   - Due dates shown in Hijri (islamic-umalqura) when the app layout is in RTL mode.
 * SPORT: T-P3-E5-W3-S1-T01-b optimistic pending state; T-P3-E6-W1-S3-T02 RTL+Hijri
 */

import React from 'react';
import { ActivityIndicator, View, Text, TouchableOpacity, StyleSheet, Alert, I18nManager } from 'react-native';
import type { NpTask, Priority } from '../types';
import { formatHijriDate } from '../i18n';
import { useTheme } from '../theme';
import type { ColorTokens } from '../theme';

const PRIORITY_COLORS = (_colors: ColorTokens): Record<Priority, string> => ({
  none: 'transparent',
  low: '#9ca3af',
  medium: '#f59e0b',
  high: '#ef4444',
  urgent: '#dc2626',
});

interface Props {
  task: NpTask;
  onToggle: (completed: boolean) => void;
  onDelete: () => void;
  onPress: () => void;
  /** True while the task is being optimistically created (pending server confirmation) */
  pending?: boolean;
}

export function TaskCard({ task, onToggle, onDelete, onPress, pending = false }: Props) {
  const { colors } = useTheme();
  const dotColor = PRIORITY_COLORS(colors)[task.priority];
  const isRtl = I18nManager.isRTL;

  /**
   * Format the due date for display.
   * In RTL (Arabic) mode: shows Hijri date (islamic-umalqura calendar).
   * In LTR mode: shows ISO YYYY-MM-DD.
   */
  const formatDueDate = (due: string): string => {
    const isoDate = due.split('T')[0] ?? due;
    if (isRtl) {
      return formatHijriDate(isoDate, 'ar');
    }
    return isoDate;
  };

  const confirmDelete = () =>
    Alert.alert('Delete task', 'This task will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);

  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.borderSubtle }, pending && styles.rowPending]}
      onPress={pending ? undefined : onPress}
      onLongPress={pending ? undefined : confirmDelete}
      accessibilityRole="button"
      accessibilityLabel={task.title}
      accessibilityState={{ busy: pending }}
    >
      <View style={styles.leading}>
        {task.priority !== 'none' && (
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
        )}
        {pending ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.checkbox} />
        ) : (
          <TouchableOpacity
            onPress={() => onToggle(!task.completed)}
            style={styles.checkbox}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: task.completed }}
          >
            <View style={[
              styles.checkboxBox,
              { borderColor: colors.primary },
              task.completed && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}>
              {task.completed && <Text style={[styles.checkmark, { color: colors.textOnPrimary }]}>✓</Text>}
            </View>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.content}>
        <Text
          style={[
            styles.title,
            { color: colors.text },
            task.completed && { textDecorationLine: 'line-through', color: colors.textTertiary },
            pending && { color: colors.textSecondary },
          ]}
          numberOfLines={2}
        >
          {task.title}
        </Text>
        {task.due_date && (
          <Text style={[styles.dueDate, { color: colors.textSecondary }]}>
            {isRtl ? formatDueDate(task.due_date) : `Due: ${formatDueDate(task.due_date)}`}
          </Text>
        )}
        {pending && <Text style={[styles.pendingLabel, { color: colors.textTertiary }]}>Saving…</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  rowPending: { opacity: 0.55 },
  leading: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  checkbox: { padding: 4 },
  checkboxBox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkmark: { fontSize: 14, fontWeight: '700' },
  content: { flex: 1 },
  title: { fontSize: 15 },
  dueDate: { fontSize: 12, marginTop: 2 },
  pendingLabel: { fontSize: 11, marginTop: 2, fontStyle: 'italic' },
});
