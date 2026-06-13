/**
 * Purpose: Assignee field display/edit in task detail — shows assignee_id or "Unassigned"
 * Inputs: assigneeId string | null, onChange callback
 * Outputs: Tappable row showing current assignee with edit affordance
 * Constraints: Assignee is stored as UUID; display name lookup not in scope (future)
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  assigneeId: string | null | undefined;
  onChange?: (id: string | null) => void;
  readonly?: boolean;
}

export function AssigneeSelector({ assigneeId, readonly }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>Assignee</Text>
      <TouchableOpacity style={styles.value} disabled={readonly} accessibilityLabel="Assignee">
        <Text style={styles.valueText}>
          {assigneeId ? `User …${assigneeId.slice(-6)}` : 'Unassigned'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  label: { fontSize: 14, color: '#374151', fontWeight: '500' },
  value: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#f3f4f6', borderRadius: 8 },
  valueText: { fontSize: 14, color: '#6b7280' },
});
