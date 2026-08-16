/**
 * Purpose: Full task list view for a given list, with D-pad navigable rows.
 * Inputs: route params { listId, listTitle }
 * Outputs: Screen with ListSidebarTV on left + TaskRowTV list on right.
 * Constraints:
 *   - Scrolling: ScrollView (not FlatList) — keeps D-pad focus model simple.
 *     If a list ever exceeds 200 tasks, replace with FlashList + FocusAwareScrollView.
 *   - Optional route param `bucket` ('today' | 'overdue' | 'upcoming') filters the task set to
 *     just that bucket (set when navigating from a Dashboard GlanceCard); omitted = full list.
 *   - Focus routing: sidebar items → task rows → mark-done buttons (left/right on each row).
 *   - Back navigation: Menu/Back button on remote (handled by navigation.goBack() via
 *     built-in TVEventHandler in react-native-tvos).
 *   - No create/edit buttons per D4 scope.
 * SPORT: Epic F — TV scaffold / F-S2-T6 (i18n TV wave).
 */

import React, { useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { TaskRowTV } from '../components/TaskRowTV'
import { ListSidebarTV } from '../components/ListSidebarTV'
import { RemoteHintBar, HINTS } from '../components/RemoteHintBar'
import { FocusableButton } from '../components/FocusableButton'
import { useTVListTasks, useMarkDone, useTVLists } from '../hooks/useTVTasks'
import { tvTheme } from '../theme'
import type { TVStackParamList } from '../navigation/TVNavigator'

type Props = NativeStackScreenProps<TVStackParamList, 'ListView'>

export function ListViewScreen({ route, navigation }: Props) {
  const { listId, listTitle, bucket } = route.params
  const { t } = useTranslation('screens')
  const { t: tCommon } = useTranslation('common')

  const [activeListId, setActiveListId] = useState(listId)
  const [markingDoneId, setMarkingDoneId] = useState<string | null>(null)

  const { lists } = useTVLists()
  const { todayTasks, upcomingTasks, overdueTasks, loading, error, refetch } =
    useTVListTasks(activeListId)
  const { markDone } = useMarkDone()

  // Filter to the selected bucket (Dashboard GlanceCard nav) or show everything (sidebar nav).
  const allTasks =
    bucket === 'today'
      ? todayTasks
      : bucket === 'overdue'
        ? overdueTasks
        : bucket === 'upcoming'
          ? upcomingTasks
          : [...overdueTasks, ...todayTasks, ...upcomingTasks]

  const bucketLabel = bucket ? t(`dashboard.${bucket}`) : null
  const displayTitle = bucketLabel ? `${listTitle} — ${bucketLabel}` : listTitle

  const handleMarkDone = async (taskId: string) => {
    setMarkingDoneId(taskId)
    await markDone(taskId)
    setMarkingDoneId(null)
  }

  const hints = allTasks.length === 0 ? HINTS.listEmpty : HINTS.listWithTasks

  // Pluralize task count
  const taskCountLabel = allTasks.length === 1
    ? t('listView.taskCount', { count: allTasks.length })
    : t('listView.taskCount_plural', { count: allTasks.length })

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{displayTitle}</Text>
        <Text style={styles.count}>{taskCountLabel}</Text>
      </View>

      <View style={styles.body}>
        {/* Sidebar — right-arrow bridges to first task row */}
        <ListSidebarTV
          lists={lists}
          selectedListId={activeListId}
          onSelectList={(id) => {
            const list = lists.find((l) => l.id === id)
            setActiveListId(id)
            if (list) {
              navigation.setParams({ listId: id, listTitle: list.title })
            }
          }}
          idPrefix="lv-sidebar"
          nextFocusRight="lv-row-0"
        />

        <View style={styles.taskArea}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={tvTheme.colors.brand} size="large" />
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>{t('listView.errorTitle')}</Text>
              <FocusableButton id="lv-retry" label={tCommon('retry')} onSelect={refetch} />
            </View>
          ) : allTasks.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t('listView.noTasks')}</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {allTasks.map((task, index) => {
                const rowId = `lv-row-${index}`
                return (
                  <TaskRowTV
                    key={task.id}
                    task={task}
                    id={rowId}
                    onSelect={() =>
                      navigation.navigate('TaskDetail', {
                        taskId: task.id,
                        listId: activeListId,
                      })
                    }
                    onMarkDone={() => handleMarkDone(task.id)}
                    markingDone={markingDoneId === task.id}
                    nextFocusUp={index > 0 ? `lv-row-${index - 1}` : undefined}
                    nextFocusDown={index < allTasks.length - 1 ? `lv-row-${index + 1}` : undefined}
                    nextFocusLeft="lv-sidebar-0"
                  />
                )
              })}
            </ScrollView>
          )}
        </View>
      </View>

      <RemoteHintBar hints={hints} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tvTheme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tvTheme.spacing.xl,
    paddingVertical: tvTheme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: tvTheme.colors.border,
    gap: tvTheme.spacing.lg,
  },
  title: {
    fontSize: tvTheme.typeScale.heading2,
    fontWeight: '700',
    color: tvTheme.colors.textPrimary,
    flex: 1,
  },
  count: {
    fontSize: tvTheme.typeScale.body,
    color: tvTheme.colors.textSecondary,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  taskArea: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tvTheme.spacing.lg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: tvTheme.spacing.xl,
    paddingBottom: tvTheme.spacing.xxl,
  },
  errorText: {
    fontSize: tvTheme.typeScale.heading3,
    color: tvTheme.colors.error,
  },
  emptyText: {
    fontSize: tvTheme.typeScale.heading3,
    color: tvTheme.colors.textDisabled,
  },
})
