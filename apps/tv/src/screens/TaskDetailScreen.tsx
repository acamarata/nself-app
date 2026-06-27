/**
 * Purpose: Read-only task detail screen for ɳTask TV.
 * Inputs: route params { taskId, listId }
 * Outputs: Full-screen task detail: title, description, due date, priority, notes + mark-done CTA.
 * Constraints:
 *   - READ ONLY per D4: no edit, no comment input, no attachment upload.
 *   - Mark-done: MarkDoneButtonTV CTA on the right panel — pressing remote OK fires it.
 *   - Layout: two-panel — left (task metadata 60%) + right (actions 40%).
 *   - Subtasks shown as a static list (count + titles, no interaction per D4).
 *   - Priority shown as a color-coded badge.
 *   - After mark-done success, auto-navigates back to ListView.
 * SPORT: Epic F — TV scaffold.
 */

import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQuery } from 'urql';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GET_TODO } from '@nself/ntask-core';
import type { NpTask } from '@nself/ntask-core';
import { MarkDoneButtonTV } from '../components/MarkDoneButtonTV';
import { FocusableButton } from '../components/FocusableButton';
import { RemoteHintBar, HINTS } from '../components/RemoteHintBar';
import { tvTheme } from '../theme';
import type { TVStackParamList } from '../navigation/TVNavigator';

type Props = NativeStackScreenProps<TVStackParamList, 'TaskDetail'>;

interface GetTodoData {
  np_todos_by_pk: NpTask | null;
}

function priorityLabel(p: string): string {
  return p.charAt(0).toUpperCase() + p.slice(1);
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
}

export function TaskDetailScreen({ route, navigation }: Props) {
  const { taskId } = route.params;

  const [{ data, fetching, error }] = useQuery<GetTodoData>({
    query: GET_TODO,
    variables: { id: taskId },
    requestPolicy: 'cache-and-network',
  });

  const task = data?.np_todos_by_pk ?? null;

  const handleMarkDoneSuccess = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const hints = task?.completed ? HINTS.taskDetailDone : HINTS.taskDetailActive;

  if (fetching && !task) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tvTheme.colors.brand} size="large" />
      </View>
    );
  }

  if (error || !task) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Task not found</Text>
        <FocusableButton
          id="td-back"
          label="Go Back"
          variant="secondary"
          onSelect={() => navigation.goBack()}
        />
      </View>
    );
  }

  const priorityColor = tvTheme.priorityColors[task.priority] ?? tvTheme.colors.textSecondary;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={2}>{task.title}</Text>
        <View style={[styles.priorityBadge, { backgroundColor: priorityColor + '33' }]}>
          <Text style={[styles.priorityText, { color: priorityColor }]}>
            {priorityLabel(task.priority)}
          </Text>
        </View>
      </View>

      {/* Body */}
      <View style={styles.body}>
        {/* Left panel — metadata */}
        <ScrollView style={styles.metaPanel} showsVerticalScrollIndicator={false}>
          {task.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Description</Text>
              <Text style={styles.sectionValue}>{task.description}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Due date</Text>
            <Text style={styles.sectionValue}>{formatDate(task.due_date)}</Text>
          </View>

          {task.notes ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Notes</Text>
              <Text style={styles.sectionValue}>{task.notes}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Created</Text>
            <Text style={styles.sectionValue}>{formatDate(task.created_at)}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Status</Text>
            <Text style={[styles.sectionValue, task.completed && { color: tvTheme.colors.success }]}>
              {task.completed ? 'Completed' : 'In progress'}
            </Text>
          </View>
        </ScrollView>

        {/* Right panel — actions */}
        <View style={styles.actionsPanel}>
          <MarkDoneButtonTV
            taskId={task.id}
            taskTitle={task.title}
            completed={task.completed}
            onSuccess={handleMarkDoneSuccess}
            id="td-mark-done"
          />
          <FocusableButton
            id="td-back-btn"
            label="← Back"
            variant="secondary"
            onSelect={() => navigation.goBack()}
            nextFocusUp="td-mark-done"
          />
        </View>
      </View>

      <RemoteHintBar hints={hints} />
    </View>
  );
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
    alignItems: 'flex-start',
    paddingHorizontal: tvTheme.spacing.xl,
    paddingVertical: tvTheme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: tvTheme.colors.border,
    gap: tvTheme.spacing.lg,
  },
  headerTitle: {
    fontSize: tvTheme.typeScale.heading1,
    fontWeight: '700',
    color: tvTheme.colors.textPrimary,
    flex: 1,
    lineHeight: tvTheme.typeScale.heading1 * 1.2,
  },
  priorityBadge: {
    paddingHorizontal: tvTheme.spacing.md,
    paddingVertical: tvTheme.spacing.xs,
    borderRadius: tvTheme.radius.sm,
    alignSelf: 'flex-start',
    marginTop: tvTheme.spacing.sm,
  },
  priorityText: {
    fontSize: tvTheme.typeScale.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  metaPanel: {
    flex: 3,
    paddingHorizontal: tvTheme.spacing.xl,
    paddingTop: tvTheme.spacing.xl,
  },
  section: {
    marginBottom: tvTheme.spacing.xl,
    gap: tvTheme.spacing.xs,
  },
  sectionLabel: {
    fontSize: tvTheme.typeScale.caption,
    color: tvTheme.colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionValue: {
    fontSize: tvTheme.typeScale.body,
    color: tvTheme.colors.textPrimary,
    lineHeight: tvTheme.typeScale.body * 1.5,
  },
  actionsPanel: {
    flex: 2,
    padding: tvTheme.spacing.xl,
    gap: tvTheme.spacing.lg,
    justifyContent: 'flex-start',
    borderLeftWidth: 1,
    borderLeftColor: tvTheme.colors.border,
  },
  errorText: {
    fontSize: tvTheme.typeScale.heading3,
    color: tvTheme.colors.error,
  },
});
