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
 * SPORT: Epic F — TV scaffold / F-S2-T6 (i18n TV wave).
 */

import React, { useCallback } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { TVFocusable } from '../navigation/FocusContext'
import { useMarkDone } from '../hooks/useTVTasks'
import { tvTheme } from '../theme'

interface MarkDoneButtonTVProps {
  taskId: string
  taskTitle: string
  completed: boolean
  onSuccess?: () => void
  id?: string
  /** Android TV: nativeID of the element below (typically the Back button). */
  nextFocusDown?: string
  /** Android TV: nativeID of the element to the left (typically the metadata panel). */
  nextFocusLeft?: string
}

export function MarkDoneButtonTV({
  taskId,
  taskTitle,
  completed,
  onSuccess,
  id = 'mark-done-btn',
  nextFocusDown,
  nextFocusLeft,
}: MarkDoneButtonTVProps) {
  const { t } = useTranslation('screens')
  const { markDone, loading } = useMarkDone()

  const handleSelect = useCallback(async () => {
    if (loading || completed) return
    const result = await markDone(taskId)
    if (!result.error) {
      onSuccess?.()
    }
  }, [taskId, loading, completed, markDone, onSuccess])

  if (completed) {
    return (
      <View style={[styles.button, styles.completedButton]}>
        <Text style={styles.completedText}>{t('taskDetail.alreadyDone')}</Text>
      </View>
    )
  }

  return (
    <TVFocusable
      id={id}
      onSelect={handleSelect}
      disabled={loading}
      nextFocusDown={nextFocusDown}
      nextFocusLeft={nextFocusLeft}
      accessibilityLabel={`Mark "${taskTitle}" as done`}
      style={styles.button}
    >
      {loading ? (
        <ActivityIndicator color={tvTheme.colors.textPrimary} size="large" />
      ) : (
        <Text style={styles.label}>{t('taskDetail.markDone')}</Text>
      )}
    </TVFocusable>
  )
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
})
