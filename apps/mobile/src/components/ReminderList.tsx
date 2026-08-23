/**
 * Purpose: Reminders for a task — list, add from presets, remove.
 * Inputs: todoId, dueDate (ISO | null); presets are relative to the due date.
 * Outputs: Reminder rows plus preset buttons.
 * Constraints:
 *   - Backed by np_reminders, the SAME table the web client uses, so a reminder
 *     set on one surface is visible on the other. The pre-existing mobile
 *     useReminders hook schedules a purely local expo-notification and persists
 *     to MMKV; that cannot sync, and nothing called it. Local scheduling is a
 *     delivery mechanism, not the source of truth.
 *   - Presets are hidden without a due date: every preset is an offset from it,
 *     and offering them with nothing to offset from produces a reminder at an
 *     arbitrary time.
 *   - Past reminders are shown but marked, rather than hidden — a user who set
 *     one for a time that has passed should see why nothing fired.
 * SPORT: P5-C-mobile — reminders parity with web.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery, useMutation } from 'urql';
import { GET_REMINDERS, CREATE_REMINDER, DELETE_REMINDER } from '@nself/ntask-core';
import type { NpReminder } from '@nself/ntask-core';
import { useTheme } from '../theme';

interface RemindersData {
  np_reminders: NpReminder[];
}

interface Props {
  todoId: string;
  dueDate: string | null;
}

/** Offsets BEFORE the due date. `atDue` is the zero-offset case. */
const PRESETS: Array<{ key: string; label: string; offsetMs: number }> = [
  { key: 'atDue', label: 'At due time', offsetMs: 0 },
  { key: '10m', label: '10 min before', offsetMs: 10 * 60_000 },
  { key: '1h', label: '1 hour before', offsetMs: 60 * 60_000 },
  { key: '1d', label: '1 day before', offsetMs: 24 * 60 * 60_000 },
];

function formatRemindAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function ReminderList({ todoId, dueDate }: Props) {
  const { colors } = useTheme();
  const [working, setWorking] = useState<string | null>(null);

  const [result, refetch] = useQuery<RemindersData>({
    query: GET_REMINDERS,
    variables: { todoId },
    requestPolicy: 'cache-and-network',
  });
  const [, execCreate] = useMutation(CREATE_REMINDER);
  const [, execDelete] = useMutation(DELETE_REMINDER);

  const reminders = result.data?.np_reminders ?? [];

  const addPreset = async (key: string, offsetMs: number) => {
    if (!dueDate) return;
    const remindAt = new Date(new Date(dueDate).getTime() - offsetMs).toISOString();
    setWorking(key);
    const res = await execCreate({ todoId, remindAt, channel: 'push' });
    setWorking(null);
    if (!res.error) refetch({ requestPolicy: 'network-only' });
  };

  const remove = async (id: string) => {
    setWorking(id);
    const res = await execDelete({ id });
    setWorking(null);
    if (!res.error) refetch({ requestPolicy: 'network-only' });
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { color: colors.text }]}>Reminders</Text>

      {result.error && reminders.length === 0 ? (
        <Text style={[styles.message, { color: colors.danger }]}>Could not load reminders.</Text>
      ) : null}

      {!result.error && reminders.length === 0 ? (
        <Text style={[styles.message, { color: colors.textSecondary }]}>No reminders.</Text>
      ) : null}

      {reminders.map((r) => {
        const past = new Date(r.remind_at).getTime() < Date.now();
        return (
          <View key={r.id} style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={[styles.when, { color: past ? colors.textTertiary : colors.text }]}>
                {formatRemindAt(r.remind_at)}
              </Text>
              {r.sent ? (
                <Text style={[styles.meta, { color: colors.textTertiary }]}>Sent</Text>
              ) : past ? (
                <Text style={[styles.meta, { color: colors.textTertiary }]}>Past</Text>
              ) : null}
            </View>
            {working === r.id ? (
              <ActivityIndicator />
            ) : (
              <TouchableOpacity
                onPress={() => remove(r.id)}
                accessibilityRole="button"
                accessibilityLabel={`Remove reminder ${formatRemindAt(r.remind_at)}`}
              >
                <Text style={[styles.remove, { color: colors.danger }]}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      {dueDate ? (
        <View style={styles.presets}>
          {PRESETS.map((p) => (
            <TouchableOpacity
              key={p.key}
              onPress={() => addPreset(p.key, p.offsetMs)}
              disabled={working === p.key}
              accessibilityRole="button"
              accessibilityLabel={p.label}
              style={[styles.preset, { borderColor: colors.border }]}
            >
              {working === p.key ? (
                <ActivityIndicator />
              ) : (
                <Text style={{ color: colors.primary, fontSize: 13 }}>{p.label}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <Text style={[styles.message, { color: colors.textTertiary }]}>
          Set a due date to add reminders.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16 },
  heading: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  rowMain: { flex: 1 },
  when: { fontSize: 14 },
  meta: { fontSize: 12, marginTop: 2 },
  remove: { fontSize: 13, fontWeight: '500' },
  message: { fontSize: 14, paddingVertical: 6 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  preset: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
});
