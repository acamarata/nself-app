/**
 * Purpose: Permission-denied state card for ɳTask (free app)
 * Inputs: optional message override
 * Outputs: Card prompting user to reconnect to their nSelf server
 * Constraints: Free app — this state is rare; typically means auth/server issue.
 * SPORT: T-P3-E5-W3-S1-T01-b 7-state permission-denied
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  message?: string;
}

export function PermissionDenied({ message }: Props) {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.title}>Access Required</Text>
      <Text style={styles.message}>
        {message ?? 'Please reconnect to your nSelf server to access your tasks.'}
      </Text>
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
    color: '#374151',
  },
  message: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});
