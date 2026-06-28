/**
 * Purpose: Banner displayed at top of screens when device is offline
 * Inputs: visible (bool); optional queueLength count
 * Outputs: Persistent yellow banner with offline message
 * Constraints: Animated fade-in; accessible; matches nSelf RN UI conventions.
 *   Text color '#1c1917' is hardcoded (accessibility requirement — must stay dark on amber bg).
 * SPORT: T-P3-E5-W3-S1-T01-b 7-state OfflineBanner
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';

interface Props {
  visible: boolean;
  queueLength?: number;
}

export function OfflineBanner({ visible, queueLength = 0 }: Props) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  if (!visible) return null;

  const message =
    queueLength > 0
      ? `Offline — ${queueLength} change${queueLength === 1 ? '' : 's'} pending sync`
      : 'Offline — changes will sync when you reconnect';

  return (
    <Animated.View
      style={[styles.banner, { backgroundColor: colors.warning, opacity }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.icon}>📶</Text>
      {/* Text color is intentionally hardcoded for WCAG AA contrast on amber/yellow bg */}
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  icon: {
    fontSize: 14,
  },
  text: {
    flex: 1,
    fontSize: 13,
    color: '#1c1917',
    fontWeight: '500',
  },
});
