/**
 * RecurrenceSelector — read/set/update/clear a recurring rule for a todo.
 * Purpose: Mobile parity with web RecurrenceSelector; same ntask-core operations.
 * Inputs: todoId; queries np_recurring_rules itself via urql.
 * Outputs: Summary row + slide-up modal (none|daily|weekly|monthly|yearly + interval).
 * Constraints: RTL-safe via I18nManager; until_date/count_limit not exposed (v1 web parity).
 * SPORT: MB-3
 */

import React, { useState } from 'react';
import {
  ActivityIndicator, Modal, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useMutation, useQuery } from 'urql';
import { useTranslation } from 'react-i18next';
import {
  CREATE_RECURRING_RULE,
  DELETE_RECURRING_RULE,
  GET_RECURRING_RULES,
  UPDATE_RECURRING_RULE,
} from '@nself/ntask-core';
import type { NpRecurringRule, RruleFrequency } from '@nself/ntask-core';
import { useTheme } from '../theme';

type FrequencyOption = 'none' | RruleFrequency;

interface Props {
  todoId: string;
}

interface RecurringRulesData {
  np_recurring_rules: NpRecurringRule[];
}

const FREQUENCIES: FrequencyOption[] = ['none', 'daily', 'weekly', 'monthly', 'yearly'];

const FREQ_I18N_KEY: Record<FrequencyOption, string> = {
  none: 'screens:taskDetail.recurrence.none',
  daily: 'screens:taskDetail.recurrence.daily',
  weekly: 'screens:taskDetail.recurrence.weekly',
  monthly: 'screens:taskDetail.recurrence.monthly',
  yearly: 'screens:taskDetail.recurrence.yearly',
};

/** Interval units mirror the web RecurrenceSelector's buildSummary logic. */
const FREQ_UNIT: Record<RruleFrequency, string> = {
  daily: 'days',
  weekly: 'weeks',
  monthly: 'months',
  yearly: 'years',
};

function buildSummary(rule: NpRecurringRule, t: (k: string) => string): string {
  const freqLabel = t(FREQ_I18N_KEY[rule.frequency as FrequencyOption] ?? FREQ_I18N_KEY.none);
  if (rule.interval_count === 1) return freqLabel;
  return t('screens:taskDetail.recurrence.interval')
    .replace('{{n}}', String(rule.interval_count))
    .replace('{{unit}}', FREQ_UNIT[rule.frequency] ?? 'times');
}

export function RecurrenceSelector({ todoId }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [result, refetch] = useQuery<RecurringRulesData>({
    query: GET_RECURRING_RULES,
    variables: { todoId },
    requestPolicy: 'cache-and-network',
  });
  const [, execCreate] = useMutation(CREATE_RECURRING_RULE);
  const [, execUpdate] = useMutation(UPDATE_RECURRING_RULE);
  const [, execDelete] = useMutation(DELETE_RECURRING_RULE);

  const rule = result.data?.np_recurring_rules?.[0] ?? null;

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedFreq, setSelectedFreq] = useState<FrequencyOption>('none');
  const [intervalCount, setIntervalCount] = useState(1);
  const [saving, setSaving] = useState(false);

  function openModal(): void {
    setSelectedFreq((rule?.frequency as FrequencyOption) ?? 'none');
    setIntervalCount(rule?.interval_count ?? 1);
    setModalVisible(true);
  }

  async function handleSave(): Promise<void> {
    setSaving(true);
    try {
      if (selectedFreq === 'none') {
        if (rule) await execDelete({ id: rule.id });
      } else if (rule) {
        await execUpdate({ id: rule.id, frequency: selectedFreq, intervalCount });
      } else {
        await execCreate({ todoId, frequency: selectedFreq, intervalCount });
      }
      refetch({ requestPolicy: 'network-only' });
    } finally {
      setSaving(false);
      setModalVisible(false);
    }
  }

  async function handleRemove(): Promise<void> {
    if (!rule) return;
    setSaving(true);
    try {
      await execDelete({ id: rule.id });
      refetch({ requestPolicy: 'network-only' });
    } finally {
      setSaving(false);
      setModalVisible(false);
    }
  }

  const summary = rule ? buildSummary(rule, t) : t('screens:taskDetail.recurrence.none');

  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { color: colors.textSecondary }]}>
        {t('screens:taskDetail.recurrence.label')}
      </Text>

      <TouchableOpacity
        style={[styles.summaryRow, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
        onPress={openModal}
        accessibilityRole="button"
        accessibilityLabel={t('screens:taskDetail.recurrence.label')}
      >
        {result.fetching ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={[styles.summaryText, { color: rule ? colors.primary : colors.textSecondary }]}>
            {summary}
          </Text>
        )}
        <Text style={[styles.chevron, { color: colors.textTertiary }]}>›</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>
              {t('screens:taskDetail.recurrence.label')}
            </Text>

            {FREQUENCIES.map((freq) => (
              <TouchableOpacity
                key={freq}
                style={[
                  styles.option,
                  { borderColor: colors.border },
                  selectedFreq === freq && {
                    borderColor: colors.primary,
                    backgroundColor: `${colors.primary}18`,
                  },
                ]}
                onPress={() => setSelectedFreq(freq)}
                accessibilityRole="radio"
                accessibilityLabel={t(FREQ_I18N_KEY[freq])}
                accessibilityState={{ selected: selectedFreq === freq }}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: colors.text },
                    selectedFreq === freq && { color: colors.primary },
                  ]}
                >
                  {t(FREQ_I18N_KEY[freq])}
                </Text>
              </TouchableOpacity>
            ))}

            {selectedFreq !== 'none' && (
              <View style={styles.intervalRow}>
                <Text style={[styles.intervalLabel, { color: colors.textSecondary }]}>
                  {t('screens:taskDetail.recurrence.every')}
                </Text>
                <TextInput
                  style={[
                    styles.intervalInput,
                    { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface },
                  ]}
                  value={String(intervalCount)}
                  onChangeText={(v) => {
                    const n = parseInt(v, 10);
                    if (!Number.isNaN(n) && n >= 1 && n <= 99) setIntervalCount(n);
                  }}
                  keyboardType="number-pad"
                  accessibilityLabel={t('screens:taskDetail.recurrence.every')}
                />
              </View>
            )}

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                onPress={handleSave}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel={t('screens:taskDetail.recurrence.save')}
              >
                {saving ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text style={[styles.actionBtnText, { color: colors.textOnPrimary }]}>
                    {t('screens:taskDetail.recurrence.save')}
                  </Text>
                )}
              </TouchableOpacity>

              {rule && selectedFreq !== 'none' && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnOutline, { borderColor: colors.danger }]}
                  onPress={handleRemove}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel={t('screens:taskDetail.recurrence.remove')}
                >
                  <Text style={[styles.actionBtnText, { color: colors.danger }]}>
                    {t('screens:taskDetail.recurrence.remove')}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnOutline, { borderColor: colors.border }]}
                onPress={() => setModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel={t('screens:taskDetail.recurrence.cancel')}
              >
                <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>
                  {t('screens:taskDetail.recurrence.cancel')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16 },
  heading: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  summaryText: { fontSize: 15, flex: 1 },
  chevron: { fontSize: 18, marginStart: 8 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, gap: 10 },
  sheetTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  option: { borderWidth: 1.5, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
  optionText: { fontSize: 15 },
  intervalRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  intervalLabel: { fontSize: 14 },
  intervalInput: { borderWidth: 1, borderRadius: 8, width: 64, paddingHorizontal: 10, paddingVertical: 6, fontSize: 15, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  actionBtn: { flex: 1, borderRadius: 8, paddingVertical: 11, alignItems: 'center' },
  actionBtnOutline: { backgroundColor: 'transparent', borderWidth: 1 },
  actionBtnText: { fontSize: 14, fontWeight: '600' },
});
