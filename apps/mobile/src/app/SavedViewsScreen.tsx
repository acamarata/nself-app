/**
 * Purpose: Saved filter views — pick one, see the tasks it matches, delete one.
 * Inputs: useSavedViews (np_saved_views) + useSmartViews (the caller's open tasks).
 * Outputs: A view picker, then the filtered task list; taps open TaskDetail.
 * Constraints:
 *   - Read-only over tasks, like SmartViewScreen. Creating and editing views
 *     stays on web, where the filter UI that produces them lives; this screen
 *     exists so views created there are usable on a phone.
 *   - Reuses seven-states EmptyState/ErrorCard/SkeletonList.
 * SPORT: P5-C-mobile — saved views parity with web.
 */

import React, { useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useSavedViews, applyFilters } from '../hooks/useSavedViews';
import { useSmartViews } from '../hooks/useSmartViews';
import { EmptyState, ErrorCard, SkeletonList } from '../components/seven-states';
import { useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'SavedViews'>;

function formatDueDate(due: string): string {
  return due.split('T')[0] ?? due;
}

export function SavedViewsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { views, loading: viewsLoading, error: viewsError, refetch, remove } = useSavedViews();
  const { today, upcoming, overdue, loading: tasksLoading, error: tasksError, refetch: refetchTasks } = useSmartViews();
  const [activeId, setActiveId] = useState<string | null>(null);

  // useSmartViews already fetches every open task for the caller; a saved view
  // is a filter over that same set, so there is nothing extra to fetch.
  const allTasks = [...today, ...upcoming, ...overdue];
  const active = views.find((v) => v.id === activeId) ?? views[0] ?? null;
  const tasks = active ? applyFilters(allTasks, active.filters) : [];

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete view', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const ok = await remove(id);
          if (ok) {
            if (activeId === id) setActiveId(null);
            refetch();
          }
        },
      },
    ]);
  };

  const renderBody = () => {
    if (viewsLoading && views.length === 0) return <SkeletonList rows={4} rowHeight={60} />;
    if (viewsError) return <ErrorCard message={viewsError} onRetry={refetch} />;
    if (views.length === 0) {
      return (
        <EmptyState
          icon="🔖"
          title="No saved views"
          hint="Save a filter on the web app and it will appear here"
        />
      );
    }
    if (tasksError) return <ErrorCard message={tasksError} onRetry={refetchTasks} />;
    if (tasksLoading && allTasks.length === 0) return <SkeletonList rows={6} rowHeight={60} />;
    if (tasks.length === 0) {
      return <EmptyState icon="🔍" title="Nothing matches" hint="No open tasks match this view right now" />;
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
        <Text style={[styles.title, { color: colors.text }]}>Saved Views</Text>
        <View style={styles.backSpacer} />
      </View>

      {views.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {views.map((view) => {
            const isActive = active?.id === view.id;
            return (
              <TouchableOpacity
                key={view.id}
                onPress={() => setActiveId(view.id)}
                onLongPress={() => handleDelete(view.id, view.name)}
                accessibilityRole="button"
                accessibilityLabel={view.name}
                accessibilityState={{ selected: isActive }}
                style={[
                  styles.chip,
                  { borderColor: isActive ? colors.primary : colors.border,
                    backgroundColor: isActive ? colors.primarySubtle : 'transparent' },
                ]}
              >
                <Text style={{ color: isActive ? colors.primary : colors.textSecondary }}>{view.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      {renderBody()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  back: { fontSize: 16 },
  backSpacer: { width: 56 },
  title: { fontSize: 17, fontWeight: '600' },
  chips: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  listContent: { padding: 12, gap: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: 15 },
  rowDue: { fontSize: 12, marginTop: 2 },
  chevron: { fontSize: 22 },
});
