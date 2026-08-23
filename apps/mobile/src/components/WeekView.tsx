/**
 * Purpose: Presentational week-at-a-glance list — one section per day of the
 *          visible week, each listing the tasks due that day with a colour bar
 *          in the task's list colour. Mirrors the web WeekStrip scope (a single
 *          week), not a full month grid.
 * Inputs: days (WeekDayGroup[] from groupTasksByWeekDay), todayIso highlight key,
 *         colorOf/listTitleOf resolvers (list_id -> list colour/title),
 *         onTaskPress callback, emptyDayLabel string.
 * Outputs: ScrollView of 7 day sections; today's header emphasised with a dot.
 * Constraints:
 *   - Pure presentation: no data fetching and no navigation — CalendarScreen
 *     owns the queries and route params, so this stays unit-testable.
 *   - The colour bar carries the list colour; the list title is also rendered
 *     as text so colour is never the only signal (WCAG 1.4.1).
 *   - Rows mirror automatically under RTL (row flexDirection flips via
 *     I18nManager; matches how TaskCard/HomeScreen handle RTL).
 * SPORT: MB-4 calendar view on mobile (web parity with WeekStrip scope)
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { SmartViewTask } from '../lib/smartViewsOps';
import { formatDayLabel, type WeekDayGroup } from '../hooks/useWeekTasks';
import { useTheme } from '../theme';

interface WeekViewProps {
  days: WeekDayGroup[];
  todayIso: string;
  colorOf: (listId: string | null) => string;
  listTitleOf: (listId: string | null) => string | null;
  onTaskPress: (task: SmartViewTask) => void;
  emptyDayLabel: string;
}

export function WeekView({ days, todayIso, colorOf, listTitleOf, onTaskPress, emptyDayLabel }: WeekViewProps) {
  const { colors } = useTheme();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {days.map((day) => {
        const isToday = day.isoDay === todayIso;
        return (
          <View
            key={day.isoDay}
            testID={`calendar-day-${day.isoDay}`}
            style={[styles.daySection, { borderColor: colors.borderSubtle }]}
          >
            <View style={styles.dayHeader}>
              <Text
                style={[
                  styles.dayLabel,
                  { color: isToday ? colors.text : colors.textSecondary },
                  isToday && styles.dayLabelToday,
                ]}
              >
                {formatDayLabel(day.date)}
              </Text>
              {isToday && <View style={[styles.todayDot, { backgroundColor: colors.primary }]} />}
            </View>

            {day.tasks.length === 0 ? (
              <Text style={[styles.emptyDay, { color: colors.textTertiary }]}>{emptyDayLabel}</Text>
            ) : (
              day.tasks.map((task) => {
                const listTitle = listTitleOf(task.list_id);
                return (
                  <TouchableOpacity
                    key={task.id}
                    style={[styles.taskRow, { backgroundColor: colors.surfaceElevated }]}
                    onPress={() => onTaskPress(task)}
                    accessibilityRole="button"
                    accessibilityLabel={listTitle ? `${task.title}, ${listTitle}` : task.title}
                  >
                    <View
                      testID={`task-color-${task.id}`}
                      style={[styles.colorBar, { backgroundColor: colorOf(task.list_id) }]}
                    />
                    <View style={styles.taskText}>
                      <Text style={[styles.taskTitle, { color: colors.text }]} numberOfLines={2}>
                        {task.title}
                      </Text>
                      {listTitle && (
                        <Text style={[styles.taskList, { color: colors.textTertiary }]} numberOfLines={1}>
                          {listTitle}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  daySection: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 8 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayLabel: { fontSize: 13, fontWeight: '600' },
  dayLabelToday: { fontWeight: '800' },
  todayDot: { width: 8, height: 8, borderRadius: 4 },
  emptyDay: { fontSize: 12, fontStyle: 'italic' },
  taskRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, padding: 10, gap: 10 },
  colorBar: { width: 4, height: 28, borderRadius: 2 },
  taskText: { flex: 1 },
  taskTitle: { fontSize: 14, fontWeight: '500' },
  taskList: { fontSize: 11, marginTop: 2 },
});
