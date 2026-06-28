/**
 * Purpose: Assignee display/picker for task detail.
 * Inputs: assigneeId string | null, onChange callback, readonly flag.
 * Outputs: Shows assignee display name (fetched from np_profiles); allows clearing.
 * Constraints: Full member-picker modal is P5-S3 scope; this version shows profile data.
 * SPORT: P5-C-mobile — replaces readonly stub.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useQuery } from 'urql';
import { GET_PROFILE } from '../lib/hasura';
import type { NpProfile } from '../types';
import { useTheme } from '../theme';

interface ProfileData {
  np_profiles_by_pk: Pick<NpProfile, 'id' | 'display_name' | 'avatar_url'> | null;
}

interface Props {
  assigneeId: string | null | undefined;
  onChange?: (id: string | null) => void;
  readonly?: boolean;
}

export function AssigneeSelector({ assigneeId, onChange, readonly = false }: Props) {
  const { colors } = useTheme();
  const [result] = useQuery<ProfileData>({
    query: GET_PROFILE,
    variables: { userId: assigneeId ?? '' },
    pause: !assigneeId,
    requestPolicy: 'cache-and-network',
  });

  const profile = result.data?.np_profiles_by_pk;
  const displayName = profile?.display_name ?? (assigneeId ? `User …${assigneeId.slice(-6)}` : 'Unassigned');

  const handlePress = () => {
    if (readonly || !onChange) return;
    if (assigneeId) {
      Alert.alert('Assignee', displayName, [
        { text: 'Remove assignee', style: 'destructive', onPress: () => onChange(null) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>Assignee</Text>
      <TouchableOpacity
        style={[styles.value, { backgroundColor: colors.borderSubtle }]}
        onPress={handlePress}
        disabled={readonly}
        accessibilityLabel={`Assignee: ${displayName}`}
        accessibilityRole={readonly ? 'text' : 'button'}
      >
        <Text style={[styles.valueText, { color: colors.textSecondary }]}>{displayName}</Text>
        {!readonly && assigneeId && <Text style={[styles.clearIcon, { color: colors.textTertiary }]}> ×</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  label: { fontSize: 14, fontWeight: '500' },
  value: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  valueText: { fontSize: 14 },
  clearIcon: { fontSize: 16, marginLeft: 2 },
});
