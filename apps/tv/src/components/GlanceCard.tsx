/**
 * Purpose: Summary glance card for Today / Upcoming / Overdue task buckets on DashboardScreen.
 * Inputs: title (bucket name), count, tasks (first N tasks to preview), onSelect
 * Outputs: Focusable card showing bucket title, count badge, and up to 5 task previews.
 * Constraints:
 *   - Shows max 5 task titles + "and N more" overflow text to avoid overflow at 10-foot distance.
 *   - Overdue card uses warning color for the count badge.
 *   - Card is a single focusable unit — pressing select navigates to the ListView for that bucket.
 *   - No internal scrolling — scrolling is the ListView's responsibility.
 *   - typeScale.heading3 for bucket title, typeScale.body for task preview lines.
 * SPORT: Epic F — TV scaffold / F-S2-T6 (i18n TV wave).
 */

import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { TVFocusable } from '../navigation/FocusContext'
import { tvTheme } from '../theme'
import type { NpTask } from '@nself/ntask-core'

const MAX_PREVIEW = 5

type GlanceVariant = 'today' | 'upcoming' | 'overdue'

interface GlanceCardProps {
  id: string
  variant: GlanceVariant
  title: string
  tasks: NpTask[]
  onSelect: () => void
  nextFocusLeft?: string
  nextFocusRight?: string
}

const variantAccent: Record<GlanceVariant, string> = {
  today: tvTheme.colors.brand,
  upcoming: tvTheme.colors.textSecondary,
  overdue: tvTheme.colors.warning,
}

export function GlanceCard({
  id,
  variant,
  title,
  tasks,
  onSelect,
  nextFocusLeft,
  nextFocusRight,
}: GlanceCardProps) {
  const { t } = useTranslation('screens')

  const accent = variantAccent[variant]
  const preview = tasks.slice(0, MAX_PREVIEW)
  const overflow = tasks.length - MAX_PREVIEW

  return (
    <TVFocusable
      id={id}
      onSelect={onSelect}
      nextFocusLeft={nextFocusLeft}
      nextFocusRight={nextFocusRight}
      accessibilityLabel={`${title}: ${tasks.length} tasks`}
      style={styles.card}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: accent }]}>{title}</Text>
        <View style={[styles.badge, { backgroundColor: accent }]}>
          <Text style={styles.badgeText}>{tasks.length}</Text>
        </View>
      </View>

      <View style={styles.taskList}>
        {preview.map((task) => (
          <Text key={task.id} style={styles.taskRow} numberOfLines={1}>
            {task.completed ? '✓ ' : '○ '}
            {task.title}
          </Text>
        ))}
        {overflow > 0 && (
          <Text style={styles.overflow}>
            {t('dashboard.moreTasks', { count: overflow })}
          </Text>
        )}
        {tasks.length === 0 && (
          <Text style={styles.empty}>{t('dashboard.noTasks')}</Text>
        )}
      </View>
    </TVFocusable>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: tvTheme.colors.surface,
    borderRadius: tvTheme.radius.lg,
    padding: tvTheme.spacing.lg,
    marginHorizontal: tvTheme.spacing.sm,
    minHeight: 400,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tvTheme.spacing.lg,
  },
  title: {
    fontSize: tvTheme.typeScale.heading3,
    fontWeight: '700',
  },
  badge: {
    borderRadius: 999,
    minWidth: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tvTheme.spacing.sm,
  },
  badgeText: {
    fontSize: tvTheme.typeScale.body,
    fontWeight: '700',
    color: tvTheme.colors.background,
  },
  taskList: {
    gap: tvTheme.spacing.md,
  },
  taskRow: {
    fontSize: tvTheme.typeScale.body,
    color: tvTheme.colors.textPrimary,
    lineHeight: tvTheme.typeScale.body * 1.4,
  },
  overflow: {
    fontSize: tvTheme.typeScale.caption,
    color: tvTheme.colors.textSecondary,
    marginTop: tvTheme.spacing.sm,
  },
  empty: {
    fontSize: tvTheme.typeScale.body,
    color: tvTheme.colors.textDisabled,
  },
})
