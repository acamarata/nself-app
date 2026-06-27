/**
 * Purpose: Standalone mark-done button for TaskDetailScreen — prominent CTA for remote OK.
 * Inputs: taskId, taskTitle (for accessibility), onSuccess callback
 * Outputs: Large focusable button; calls TOGGLE_TODO mutation on select.
 * Constraints:
 *   - Uses useMarkDone hook from useTVTasks.
 *   - Shows loading state inline (spinner text, not spinner icon).
 *   - Post-success: calls onSuccess() so the parent screen can navigate back.
 *   - Already-completed tasks: renders a "Done" static label (non-interactive).
 *   - Size: 160px height, full-width in its container — the most prominent affordance on screen.
 * SPORT: Epic F — TV scaffold.
 */

import React, { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { TVFocusable } from '../navigation/FocusContext';
import { useMarkDone } from '../hooks/useTVTasks';
import { tvTheme } from '../theme';

interface MarkDoneButtonTVProps {
  taskId: string;
  taskTitle: string;
  completed: boolean;
  onSuccess?: () => void;
  id?: string;
}

export function MarkDoneButtonTV({
  taskId,
  taskTitle,
  completed,
  onSuccess,
  id = 'mark-done-btn',
}: MarkDoneButtonTVProps) {
  const { markDone, loading } = useMarkDone();

  const handleSelect = useCallback(async () => {
    if (loading || completed) return;
    const result = await markDone(taskId);
    if (!result.error) {
      onSuccess?.();
    }
  }, [taskId, loading, completed, markDone, onSuccess]);

  if (completed) {
    return (
      <View style={[styles.button, styles.completedButton]}>
        <Text style={styles.completedText}>✓ Done</Text>
      </View>
    );
  }

  return (
    <TVFocusable
      id={id}
      onSelect={handleSelect}
      disabled={loading}
      accessibilityLabel={`Mark "${taskTitle}" as done`}
      style={styles.button}
    >
      {loading ? (
        <ActivityIndicator color={tvTheme.colors.textPrimary} size="large" />
      ) : (
        <Text style={styles.label}>✓  Mark as Done</Text>
      )}
    </TVFocusable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 160,
    backgroundColor: tvTheme.colors.doneButton,
    borderRadius: tvTheme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedButton: {
    backgroundColor: tvTheme.colors.surfaceSecondary,
  },
  label: {
    fontSize: tvTheme.typeScale.heading2,
    fontWeight: '700',
    color: tvTheme.colors.textPrimary,
  },
  completedText: {
    fontSize: tvTheme.typeScale.heading2,
    fontWeight: '700',
    color: tvTheme.colors.success,
  },
});
