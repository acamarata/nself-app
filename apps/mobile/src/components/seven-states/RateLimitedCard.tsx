/**
 * Purpose: Rate-limited state card with countdown timer
 * Inputs: retryAfter seconds (default 30); onRetry called after countdown
 * Outputs: Card with live countdown; auto-calls onRetry when timer expires
 * SPORT: T-P3-E5-W3-S1-T01-b 7-state rate-limited
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  retryAfter?: number;
  onRetry?: () => void;
}

export function RateLimitedCard({ retryAfter = 30, onRetry }: Props) {
  const [countdown, setCountdown] = useState(retryAfter);

  useEffect(() => {
    if (countdown <= 0) {
      onRetry?.();
      return;
    }
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown, onRetry]);

  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text style={styles.icon}>⏱️</Text>
      <Text style={styles.title}>Too Many Requests</Text>
      <Text style={styles.message}>Retrying in {countdown}s</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  icon: {
    fontSize: 40,
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400e',
  },
  message: {
    fontSize: 14,
    color: '#374151',
  },
});
