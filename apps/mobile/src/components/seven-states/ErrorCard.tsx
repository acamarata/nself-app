/**
 * Purpose: Error state card for all 7-state screens
 * Inputs: message string; onRetry callback
 * Outputs: Centered error card with retry button; pull-to-refresh hint
 * SPORT: T-P3-E5-W3-S1-T01-b 7-state error
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  message?: string;
  onRetry?: () => void;
}

export function ErrorCard({ message = 'Something went wrong', onRetry }: Props) {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.title}>Error</Text>
      <Text style={styles.message}>{message}</Text>
      {!!onRetry && (
        <TouchableOpacity style={styles.button} onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry">
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.hint}>Pull down to refresh</Text>
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
    color: '#dc2626',
  },
  message: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    marginTop: 12,
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    color: '#9ca3af',
  },
});
