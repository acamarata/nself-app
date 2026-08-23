/**
 * Purpose: Bottom bulk action bar for ListScreen multi-select — the mobile
 *          counterpart of web's BulkActionBar (complete/uncomplete/delete/exit).
 * Inputs: selectedCount plus onComplete/onUncomplete/onDelete/onExit callbacks;
 *         onDelete must only be invoked AFTER the user confirms.
 * Outputs: Sticky bottom toolbar with the selected count, the three bulk
 *          actions, and an exit button; renders null when nothing is selected.
 * Constraints:
 *   - Delete asks for confirmation via Alert before invoking onDelete.
 *   - Every control carries accessibilityLabel + accessibilityRole; the
 *     selected count is announced to VoiceOver via AccessibilityInfo when it
 *     changes.
 *   - RTL-safe: logical (start/end) spacing only; flexDirection mirrors
 *     automatically under I18nManager RTL.
 *   - {{count}} is substituted manually (web parity) because passing count to
 *     t() would trigger i18next plural key lookup.
 * SPORT: MB-5 multi-select and bulk operations on mobile
 */

import React, { useEffect } from 'react';
import {
  AccessibilityInfo, Alert, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';

interface Props {
  selectedCount: number;
  onComplete: () => void;
  onUncomplete: () => void;
  onDelete: () => void;
  onExit: () => void;
}

/** Substitute {{count}} in a translated template with the actual count. */
function withCount(template: string, count: number): string {
  return template.replace('{{count}}', String(count));
}

export function BulkActionBar({ selectedCount, onComplete, onUncomplete, onDelete, onExit }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const countLabel = withCount(t('screens:list.bulk.selectedCount'), selectedCount);

  // Announce selection changes to VoiceOver. Guarded so nothing announces for
  // the empty-selection frame before the bar unmounts.
  useEffect(() => {
    if (selectedCount > 0) {
      AccessibilityInfo.announceForAccessibility(countLabel);
    }
  }, [selectedCount, countLabel]);

  if (selectedCount === 0) return null;

  const confirmDelete = () =>
    Alert.alert(t('screens:list.bulk.deleteTitle'), t('screens:list.bulk.deleteMessage'), [
      { text: t('common:cancel'), style: 'cancel' },
      { text: t('common:delete'), style: 'destructive', onPress: onDelete },
    ]);

  return (
    <View
      style={[styles.bar, { backgroundColor: colors.surfaceElevated, borderTopColor: colors.borderSubtle }]}
      accessibilityRole="toolbar"
      accessibilityLabel={t('screens:list.bulk.title')}
    >
      <TouchableOpacity
        style={styles.exitBtn}
        onPress={onExit}
        accessibilityRole="button"
        accessibilityLabel={t('screens:list.bulk.exit')}
      >
        <Text style={[styles.exitIcon, { color: colors.textSecondary }]}>✕</Text>
      </TouchableOpacity>

      <Text
        style={[styles.count, { color: colors.text }]}
        accessibilityRole="text"
        accessibilityLabel={countLabel}
      >
        {countLabel}
      </Text>

      <TouchableOpacity
        style={[styles.action, { borderColor: colors.borderSubtle }]}
        onPress={onComplete}
        accessibilityRole="button"
        accessibilityLabel={t('screens:list.bulk.complete')}
      >
        <Text style={[styles.actionText, { color: colors.text }]}>
          {t('screens:list.bulk.complete')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.action, { borderColor: colors.borderSubtle }]}
        onPress={onUncomplete}
        accessibilityRole="button"
        accessibilityLabel={t('screens:list.bulk.uncomplete')}
      >
        <Text style={[styles.actionText, { color: colors.text }]}>
          {t('screens:list.bulk.uncomplete')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.action, { borderColor: colors.danger }]}
        onPress={confirmDelete}
        accessibilityRole="button"
        accessibilityLabel={t('screens:list.bulk.delete')}
      >
        <Text style={[styles.actionText, { color: colors.danger }]}>
          {t('screens:list.bulk.delete')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    start: 0,
    end: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8,
  },
  exitBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitIcon: { fontSize: 18, fontWeight: '600' },
  count: { fontSize: 14, fontWeight: '600', marginEnd: 4 },
  action: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontSize: 14, fontWeight: '500' },
});
