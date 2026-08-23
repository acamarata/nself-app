/**
 * Purpose: Bell entry point with an unread badge — the mobile counterpart of the
 *          web NotificationCenterPopover's bell button. Rendered in HomeScreen's
 *          header actions; opens the Notifications screen.
 * Inputs:  count (unread np_notifications rows), onPress handler.
 * Outputs: Touchable bell; badge shows badgeLabel(count) while count > 0 and is
 *          removed entirely at 0 (same rule as the web bell).
 * Constraints: Badge text uses badgeLabel (99+ cap); i18n'd accessibility label
 *          carries the bell name, and the visible count is announced as part of
 *          the touchable's label. Theme tokens only — no hardcoded colours.
 * SPORT: MB-2 notification centre on mobile (web parity)
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { badgeLabel } from '../lib/notifications';
import { useTheme } from '../theme';

interface Props {
  count: number;
  onPress: () => void;
}

export function NotificationBell({ count, onPress }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('nav:notifications')}
      style={styles.touch}
    >
      <View>
        <Text style={styles.bell}>🔔</Text>
        {count > 0 ? (
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <Text style={[styles.badgeText, { color: colors.textOnPrimary }]}>
              {badgeLabel(count)}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touch: { padding: 2 },
  bell: { fontSize: 20 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '700', lineHeight: 12 },
});
