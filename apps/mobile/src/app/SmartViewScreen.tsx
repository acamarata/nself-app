/**
 * Purpose: Today / Upcoming / Overdue smart view — cross-list read-only task list with
 *          filter chips, mirroring the "Smart Views" feature documented in FEATURES.md
 *          (Today view, Overdue view) that previously existed only as a web/doc concept.
 * Inputs: useSmartViews hook (urql GET_MY_OPEN_TASKS); navigation to TaskDetail on tap.
 * Outputs: Filter chip row (Today | Upcoming | Overdue) + FlatList of matching tasks.
 * Constraints:
 *   - Read-only view — no create/edit here; tapping a row opens TaskDetail for the
 *     full editing experience already built for ListScreen.
 *   - Reuses seven-states EmptyState/ErrorCard/SkeletonList for consistency; no offline
 *     queue interaction needed since this is a pure read view.
 * SPORT: mobile/web parity delta — Smart Views (Today/Overdue) small mobile addition
 */

import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useSmartViews, type SmartViewBucket } from '../hooks/useSmartViews';
import type { SmartViewTask } from '../lib/smartViewsOps';
import { EmptyState, ErrorCard, SkeletonList } from '../components/seven-states';
import { useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'SmartView'>;

const CHIPS: { key: SmartViewBucket; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'upcoming', label: 'Upcoming' },
];

function formatDueDate(due: string): string {
  return due.split('T')[0] ?? due;
}

export function SmartViewScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { today, upcoming, overdue, loading, error, refetch } = useSmartViews();
  const [active, setActive] = useState<SmartViewBucket>('today');

  const buckets: Record<SmartViewBucket, SmartViewTask[]> = { today, upcoming, overdue };
  const tasks = buckets[active];

  const emptyCopy: Record<SmartViewBucket, { title: string; hint: string }> = {
    today: { title: 'Nothing due today', hint: 'Tasks due today across all lists will show up here' },
    overdue: { title: 'Nothing overdue', hint: 'Past-due tasks across all lists will show up here' },
    upcoming: { title: 'Nothing upcoming', hint: 'Future-dated tasks across all lists will show up here' },
  };

  const renderBody = () => {
    if (loading && tasks.length === 0) return <SkeletonList rows={6} rowHeight={60} />;
    if (error) return <ErrorCard message={error} onRetry={refetch} />;
    if (tasks.length === 0) {
      const copy = emptyCopy[active];
      return <EmptyState icon="🗓️" title={copy.title} hint={copy.hint} />;
    }
    return (
      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, { backgroundColor: colors.surfaceElevated, shadowColor: colors.shadow }]}
            onPress={() => navigation.navigate('TaskDetail', { taskId: item.id, listId: item.list_id ?? '' })}
            accessibilityLabel={item.title}
            accessibilityRole="button"
          >
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
              {!!item.due_date && (
                <Text style={[styles.rowDue, { color: colors.textTertiary }]}>{formatDueDate(item.due_date)}</Text>
              )}
            </View>
            <Text style={[styles.chevron, { color: colors.border }]}>›</Text>
          </TouchableOpacity>
        )}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surfaceElevated, borderBottomColor: colors.borderSubtle }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <Text style={[styles.back, { color: colors.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Smart Views</Text>
        <View style={styles.backSpacer} />
      </View>

      <View style={styles.chipRow}>
        {CHIPS.map((chip) => {
          const isActive = chip.key === active;
          return (
            <TouchableOpacity
              key={chip.key}
              style={[
                styles.chip,
                { borderColor: colors.border },
                isActive && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setActive(chip.key)}
              accessibilityRole="button"
              accessibilityLabel={`${chip.label} filter`}
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.chipText, { color: isActive ? colors.textOnPrimary : colors.text }]}>
                {chip.label} ({buckets[chip.key].length})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.body}>{renderBody()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 14, borderBottomWidth: 1 },
  back: { fontSize: 16, width: 60 },
  backSpacer: { width: 60 },
  title: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  chipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '600' },
  body: { flex: 1 },
  listContent: { padding: 16, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowDue: { fontSize: 12, marginTop: 2 },
  chevron: { fontSize: 22 },
});
