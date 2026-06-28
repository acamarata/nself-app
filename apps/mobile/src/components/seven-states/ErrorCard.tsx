/**
 * Purpose: Error state card for all 7-state screens
 * Inputs: message string; onRetry callback
 * Outputs: Centered error card with retry button; pull-to-refresh hint
 * SPORT: T-P3-E5-W3-S1-T01-b 7-state error
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../theme';

interface Props {
  message?: string;
  onRetry?: () => void;
}

export function ErrorCard({ message = 'Something went wrong', onRetry }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text style={styles.icon}>⚠️</Text>
      <Text style={[styles.title, { color: colors.danger }]}>Error</Text>
      <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
      {!!onRetry && (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry"
        >
          <Text style={[styles.buttonText, { color: colors.textOnPrimary }]}>Retry</Text>
        </TouchableOpacity>
      )}
      <Text style={[styles.hint, { color: colors.textTertiary }]}>Pull down to refresh</Text>
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
    fontSize: 18,
    fontWeight: '700',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
  },
});
