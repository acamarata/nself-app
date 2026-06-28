/**
 * Purpose: Loading skeleton — 10 animated placeholder rows for TaskList
 * Inputs: rows count (default 10); rowHeight (default 60)
 * Outputs: FlatList of pulsing skeleton rows
 * Constraints: Uses Animated API only (no third-party); matches estimatedItemSize=60 on FlashList.
 * SPORT: T-P3-E5-W3-S1-T01-b 7-state skeleton
 */

import React, { useEffect, useRef } from 'react';
import { Animated, FlatList, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme';
import type { ColorTokens } from '../../theme';

interface Props {
  rows?: number;
  rowHeight?: number;
}

function SkeletonRow({ index, pulse, colors }: { index: number; pulse: Animated.Value; colors: ColorTokens }) {
  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });
  // Stagger rows slightly
  const translateX = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0],
  });
  void translateX; // not used but documents intent
  const adjustedOpacity = Animated.multiply(
    opacity,
    new Animated.Value(1 - index * 0.05),
  );

  return (
    <Animated.View style={[styles.row, { opacity: adjustedOpacity }]}>
      <View style={[styles.checkbox, { backgroundColor: colors.skeleton }]} />
      <View style={styles.content}>
        <View style={[styles.textLine, { width: `${65 + (index % 3) * 10}%`, backgroundColor: colors.skeleton }]} />
        <View style={[styles.textLineSm, { width: `${30 + (index % 2) * 15}%`, backgroundColor: colors.skeletonHighlight }]} />
      </View>
    </Animated.View>
  );
}

export function SkeletonList({ rows = 10, rowHeight = 60 }: Props) {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  const data = Array.from({ length: rows }, (_, i) => i);

  return (
    <FlatList
      data={data}
      keyExtractor={(i) => String(i)}
      scrollEnabled={false}
      renderItem={({ item }) => (
        <View style={{ height: rowHeight }}>
          <SkeletonRow index={item} pulse={pulse} colors={colors} />
        </View>
      )}
      accessibilityLabel="Loading tasks"
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  content: {
    flex: 1,
    gap: 6,
  },
  textLine: {
    height: 12,
    borderRadius: 6,
  },
  textLineSm: {
    height: 9,
    borderRadius: 4,
  },
});
