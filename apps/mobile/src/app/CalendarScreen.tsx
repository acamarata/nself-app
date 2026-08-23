/**
 * Purpose: Calendar screen — week-at-a-glance of the caller's open, due-dated
 *          tasks (colour-coded by list) with previous/next/this-week navigation.
 *          Mobile counterpart of the web CalendarPage + WeekStrip, scoped to a
 *          single week rather than a month grid.
 * Inputs: useWeekTasks (which reuses the smart-views GET_MY_OPEN_TASKS query —
 *         no second task source); urql GET_LISTS for list colours and titles;
 *         navigation to TaskDetail on row tap.
 * Outputs: Stack screen "Calendar": i18n'd header, week nav bar, WeekView body,
 *          seven-state loading/error handling via the shared components.
 * Constraints:
 *   - Read-only view: no create/edit here; tapping a row opens TaskDetail.
 *   - Due-date data comes exclusively from the smart-view query so the calendar
 *     can never disagree with Today/Upcoming/Overdue.
 *   - List colour resolution goes through parseColor (lib/colors) so invalid
 *     legacy colours fall back to the same indigo HomeScreen uses.
 * SPORT: MB-4 calendar view on mobile (web parity with WeekStrip scope)
 */

import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useQuery } from 'urql';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, NpList } from '../types';
import { GET_LISTS } from '../lib/hasura';
import { parseColor } from '../lib/colors';
import { addDays, formatWeekRange, groupTasksByWeekDay, isoDayOf, startOfWeek, useWeekTasks } from '../hooks/useWeekTasks';
import { ErrorCard, SkeletonList } from '../components/seven-states';
import { WeekView } from '../components/WeekView';
import { useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Calendar'>;

interface ListsData { np_lists: NpList[] }

export function CalendarScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const { tasks, loading, error, refetch } = useWeekTasks();
  const [listsResult] = useQuery<ListsData>({
    query: GET_LISTS,
    requestPolicy: 'cache-and-network',
  });
  const lists = listsResult.data?.np_lists ?? [];

  const colorOf = useCallback(
    (listId: string | null): string => parseColor(lists.find((list) => list.id === listId)?.color),
    [lists],
  );
  const listTitleOf = useCallback(
    (listId: string | null): string | null => lists.find((list) => list.id === listId)?.title ?? null,
    [lists],
  );

  const days = useMemo(() => groupTasksByWeekDay(tasks, weekStart), [tasks, weekStart]);
  const todayIso = isoDayOf(new Date());
  const isCurrentWeek = weekStart.getTime() === startOfWeek(new Date()).getTime();

  const goToTask = useCallback(
    (taskId: string, listId: string | null) => navigation.navigate('TaskDetail', { taskId, listId: listId ?? '' }),
    [navigation],
  );

  const renderBody = () => {
    if (loading && tasks.length === 0) return <SkeletonList rows={7} rowHeight={64} />;
    if (error) return <ErrorCard message={error} onRetry={refetch} />;
    return (
      <WeekView
        days={days}
        todayIso={todayIso}
        colorOf={colorOf}
        listTitleOf={listTitleOf}
        onTaskPress={(task) => goToTask(task.id, task.list_id)}
        emptyDayLabel={t('screens:calendar.emptyDay')}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surfaceElevated, borderBottomColor: colors.borderSubtle }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('common:back')}
        >
          <Text style={[styles.back, { color: colors.primary }]}>‹ {t('common:back')}</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{t('nav:calendar')}</Text>
        <View style={styles.backSpacer} />
      </View>

      <View style={styles.weekNav}>
        <TouchableOpacity
          onPress={() => setWeekStart(addDays(weekStart, -7))}
          accessibilityRole="button"
          accessibilityLabel={t('screens:calendar.prevWeek')}
          style={styles.weekBtn}
        >
          <Text style={[styles.weekBtnText, { color: colors.primary }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.weekLabel, { color: colors.text }]}>{formatWeekRange(weekStart)}</Text>
        <TouchableOpacity
          onPress={() => setWeekStart(addDays(weekStart, 7))}
          accessibilityRole="button"
          accessibilityLabel={t('screens:calendar.nextWeek')}
          style={styles.weekBtn}
        >
          <Text style={[styles.weekBtnText, { color: colors.primary }]}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setWeekStart(startOfWeek(new Date()))}
          disabled={isCurrentWeek}
          accessibilityRole="button"
          accessibilityLabel={t('screens:calendar.today')}
          accessibilityState={{ disabled: isCurrentWeek }}
          style={[styles.todayBtn, { borderColor: colors.border }, isCurrentWeek && styles.todayBtnDisabled]}
        >
          <Text style={[styles.todayBtnText, { color: isCurrentWeek ? colors.textTertiary : colors.primary }]}>
            {t('screens:calendar.today')}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>{renderBody()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 14, borderBottomWidth: 1 },
  back: { fontSize: 16, width: 70 },
  backSpacer: { width: 70 },
  title: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  weekBtn: { paddingVertical: 4, paddingHorizontal: 10 },
  weekBtnText: { fontSize: 20, fontWeight: '700' },
  weekLabel: { fontSize: 14, fontWeight: '600', minWidth: 110, textAlign: 'center' },
  todayBtn: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  todayBtnDisabled: { opacity: 0.55 },
  todayBtnText: { fontSize: 13, fontWeight: '600' },
  body: { flex: 1 },
});
