/**
 * Purpose: Dashboard glanceable overview — Today / Upcoming / Overdue task buckets.
 * Inputs: none (urql client injected by TVNavigator)
 * Outputs: Full-screen three-column layout with GlanceCards + ListSidebarTV switcher.
 * Constraints:
 *   - Default list: first list in the user's list array (is_default = true preferred, else index 0).
 *   - List switcher: D-pad left from any card navigates to the ListSidebarTV; right returns to cards.
 *   - Selecting a GlanceCard navigates to ListView filtered to that bucket (passes bucket as param).
 *   - Auto-refresh every 60s via useFocusEffect (TV displays are passive monitors).
 *   - No pull-to-refresh (TV UX: no swipe gestures).
 *   - Error state: full-screen error text with retry button.
 * SPORT: Epic F — TV scaffold / F-S2-T6 (i18n TV wave).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { GlanceCard } from '../components/GlanceCard'
import { ListSidebarTV } from '../components/ListSidebarTV'
import { RemoteHintBar, HINTS } from '../components/RemoteHintBar'
import { FocusableButton } from '../components/FocusableButton'
import { useTVLists, useTVListTasks } from '../hooks/useTVTasks'
import { tvTheme } from '../theme'
import type { TVStackParamList } from '../navigation/TVNavigator'

type Props = NativeStackScreenProps<TVStackParamList, 'Dashboard'>

export function DashboardScreen({ navigation }: Props) {
  const { t } = useTranslation('screens')
  const { t: tCommon } = useTranslation('common')

  const { lists, loading: listsLoading, error: listsError, refetch: refetchLists } = useTVLists()
  const [selectedListId, setSelectedListId] = useState<string | null>(null)

  // Auto-select first default list once lists load
  useEffect(() => {
    if (lists.length > 0 && !selectedListId) {
      const defaultList = lists.find((l) => l.is_default) ?? lists[0]
      setSelectedListId(defaultList.id)
    }
  }, [lists, selectedListId])

  const { todayTasks, upcomingTasks, overdueTasks, loading: tasksLoading, error: tasksError, refetch: refetchTasks } =
    useTVListTasks(selectedListId ?? '')

  // Auto-refresh every 60s — TV dashboard is a passive monitor
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    refreshTimer.current = setInterval(() => {
      refetchTasks()
    }, 60_000)
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current)
    }
  }, [refetchTasks])

  const handleRetry = useCallback(() => {
    refetchLists()
    refetchTasks()
  }, [refetchLists, refetchTasks])

  const handleSelectGlanceCard = useCallback(
    (bucket: 'today' | 'upcoming' | 'overdue') => {
      if (selectedListId) {
        navigation.navigate('ListView', {
          listId: selectedListId,
          listTitle: lists.find((l) => l.id === selectedListId)?.title ?? t('dashboard.title'),
          bucket,
        })
      }
    },
    [navigation, selectedListId, lists, t],
  )

  if (listsLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tvTheme.colors.brand} size="large" />
        <Text style={styles.loadingText}>{tCommon('loading')}</Text>
      </View>
    )
  }

  if (listsError || tasksError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t('dashboard.errorTitle')}</Text>
        <Text style={styles.errorSub}>{(listsError ?? tasksError)?.message}</Text>
        <FocusableButton id="retry-btn" label={tCommon('retry')} onSelect={handleRetry} />
      </View>
    )
  }

  // Empty-lists guard — shown after load completes with zero lists
  if (lists.length === 0 && !listsLoading && !listsError) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>
          {t('dashboard.noLists', 'No lists found. Add lists in the ɳTask mobile app.')}
        </Text>
      </View>
    )
  }

  const selectedListTitle = lists.find((l) => l.id === selectedListId)?.title ?? ''

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('dashboard.title')}</Text>
        {selectedListTitle ? (
          <Text style={styles.subtitle}>{selectedListTitle}</Text>
        ) : null}
        {tasksLoading && (
          <ActivityIndicator color={tvTheme.colors.brand} size="small" style={styles.refreshIndicator} />
        )}
      </View>

      {/* Body */}
      <View style={styles.body}>
        {/* Sidebar — right-arrow bridges to card-today (initial focus anchor) */}
        <ListSidebarTV
          lists={lists}
          selectedListId={selectedListId}
          onSelectList={setSelectedListId}
          idPrefix="sidebar"
          nextFocusRight="card-today"
        />

        {/* Three-column glance area */}
        <View style={styles.cards}>
          <GlanceCard
            id="card-overdue"
            variant="overdue"
            title={t('dashboard.overdue')}
            tasks={overdueTasks}
            onSelect={() => handleSelectGlanceCard('overdue')}
            nextFocusLeft="sidebar-0"
            nextFocusRight="card-today"
          />
          <GlanceCard
            id="card-today"
            variant="today"
            title={t('dashboard.today')}
            tasks={todayTasks}
            onSelect={() => handleSelectGlanceCard('today')}
            hasTVPreferredFocus
            nextFocusLeft="card-overdue"
            nextFocusRight="card-upcoming"
          />
          <GlanceCard
            id="card-upcoming"
            variant="upcoming"
            title={t('dashboard.upcoming')}
            tasks={upcomingTasks}
            onSelect={() => handleSelectGlanceCard('upcoming')}
            nextFocusLeft="card-today"
          />
        </View>
      </View>

      <RemoteHintBar hints={HINTS.dashboard} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tvTheme.colors.background,
  },
  center: {
    flex: 1,
    backgroundColor: tvTheme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tvTheme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tvTheme.spacing.xl,
    paddingTop: tvTheme.spacing.xl,
    paddingBottom: tvTheme.spacing.lg,
    gap: tvTheme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: tvTheme.colors.border,
  },
  title: {
    fontSize: tvTheme.typeScale.heading2,
    fontWeight: '800',
    color: tvTheme.colors.textPrimary,
  },
  subtitle: {
    fontSize: tvTheme.typeScale.heading3,
    color: tvTheme.colors.textSecondary,
    flex: 1,
  },
  refreshIndicator: {
    marginLeft: tvTheme.spacing.sm,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  cards: {
    flex: 1,
    flexDirection: 'row',
    padding: tvTheme.spacing.lg,
    gap: tvTheme.spacing.sm,
  },
  loadingText: {
    fontSize: tvTheme.typeScale.body,
    color: tvTheme.colors.textSecondary,
    marginTop: tvTheme.spacing.md,
  },
  emptyText: {
    fontSize: tvTheme.typeScale.body,
    color: tvTheme.colors.textPrimary,
    textAlign: 'center',
    paddingHorizontal: tvTheme.spacing.xl,
  },
  errorText: {
    fontSize: tvTheme.typeScale.heading3,
    color: tvTheme.colors.error,
    fontWeight: '600',
  },
  errorSub: {
    fontSize: tvTheme.typeScale.body,
    color: tvTheme.colors.textSecondary,
  },
})
