/**
 * Purpose: Single task row for the TV ListView screen.
 * Inputs: task (NpTask), onSelect (navigate to detail), onMarkDone
 * Outputs: Focusable row with title, priority badge, due date, mark-done button.
 * Constraints:
 *   - Minimum row height: 96px (comfortable D-pad target at 10ft).
 *   - Priority badge: color from theme.priorityColors.
 *   - Completed tasks show strike-through title + muted color.
 *   - Mark-done button is a separate focusable to the RIGHT of the row (nextFocusRight routing).
 *   - Due date rendered as "Today", "Tomorrow", "Jan 15", or "Overdue: Jan 10" for scannability.
 *   - No subtask/comment counts on TV (out of scope per D4).
 * SPORT: Epic F — TV scaffold.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TVFocusable } from '../navigation/FocusContext';
import { tvTheme } from '../theme';
import type { NpTask } from '@nself/ntask-core';

function formatDueDate(due: string | null): string | null {
  if (!due) return null;
  const d = new Date(due);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const dStr = due.substring(0, 10);
  const todayStr = today.toISOString().substring(0, 10);
  const tomorrowStr = tomorrow.toISOString().substring(0, 10);

  if (dStr === todayStr) return 'Today';
  if (dStr === tomorrowStr) return 'Tomorrow';
  if (dStr < todayStr) return `Overdue: ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface TaskRowTVProps {
  task: NpTask;
  onSelect: () => void;
  onMarkDone: () => void;
  markingDone?: boolean;
  /** Focus id for this row's main area */
  id: string;
  nextFocusUp?: string;
  nextFocusDown?: string;
}

export function TaskRowTV({
  task,
  onSelect,
  onMarkDone,
  markingDone = false,
  id,
  nextFocusUp,
  nextFocusDown,
}: TaskRowTVProps) {
  const markDoneId = `${id}-done`;
  const dueLabel = formatDueDate(task.due_date);
  const isOverdue = dueLabel?.startsWith('Overdue') ?? false;

  return (
    <View style={styles.row}>
      <TVFocusable
        id={id}
        onSelect={onSelect}
        nextFocusUp={nextFocusUp}
        nextFocusDown={nextFocusDown}
        nextFocusRight={task.completed ? undefined : markDoneId}
        accessibilityLabel={`${task.title}${dueLabel ? `, due ${dueLabel}` : ''}`}
        style={styles.mainArea}
      >
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <View
              style={[
                styles.priorityDot,
                { backgroundColor: tvTheme.priorityColors[task.priority] ?? tvTheme.colors.textSecondary },
              ]}
            />
            <Text
              style={[styles.title, task.completed && styles.titleDone]}
              numberOfLines={2}
            >
              {task.title}
            </Text>
          </View>
          {dueLabel && (
            <Text
              style={[styles.due, isOverdue && { color: tvTheme.colors.warning }]}
            >
              {dueLabel}
            </Text>
          )}
        </View>
      </TVFocusable>

      {!task.completed && (
        <TVFocusable
          id={markDoneId}
          onSelect={onMarkDone}
          nextFocusUp={nextFocusUp}
          nextFocusDown={nextFocusDown}
          nextFocusLeft={id}
          accessibilityLabel={`Mark "${task.title}" as done`}
          style={styles.doneButton}
        >
          <Text style={styles.doneText}>{markingDone ? '…' : '✓'}</Text>
        </TVFocusable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: tvTheme.spacing.xs,
    gap: tvTheme.spacing.md,
  },
  mainArea: {
    flex: 1,
    backgroundColor: tvTheme.colors.surface,
    borderRadius: tvTheme.radius.md,
    padding: tvTheme.spacing.lg,
    minHeight: 96,
    justifyContent: 'center',
  },
  content: {
    gap: tvTheme.spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tvTheme.spacing.sm,
  },
  priorityDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    flexShrink: 0,
  },
  title: {
    fontSize: tvTheme.typeScale.heading3,
    color: tvTheme.colors.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
  titleDone: {
    textDecorationLine: 'line-through',
    color: tvTheme.colors.textDisabled,
  },
  due: {
    fontSize: tvTheme.typeScale.caption,
    color: tvTheme.colors.textSecondary,
    marginLeft: 28, // align with title (dot width + gap)
  },
  doneButton: {
    width: 96,
    height: 96,
    backgroundColor: tvTheme.colors.doneButton,
    borderRadius: tvTheme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    fontSize: tvTheme.typeScale.heading2,
    color: tvTheme.colors.textPrimary,
    fontWeight: '700',
  },
});
