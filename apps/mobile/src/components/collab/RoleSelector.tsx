/**
 * Purpose: Inline role picker — row of touchable pills for admin/editor/viewer.
 *          Owner role is display-only; cannot be set via this component.
 * Inputs:  currentRole (string), onSelect callback, optional disabled flag.
 * Outputs: Renders a horizontal row of role pills; fires onSelect on tap.
 * Constraints:
 *   - Owner pill is non-interactive (shown grayed if currentRole === 'owner')
 *   - Selected pill is indigo-filled; unselected is bordered
 *   - WCAG: accessibilityRole="radio" with selected state
 * SPORT: P5-L-collab-ops
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface RoleSelectorProps {
  currentRole: string;
  onSelect: (role: string) => void;
  disabled?: boolean;
}

const SELECTABLE_ROLES: { value: string; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
];

/**
 * Purpose: Displays a horizontal row of role pills. Owner cannot be set here.
 * Inputs:  currentRole, onSelect, disabled
 * Outputs: Role pill row
 * Constraints: Only admin/editor/viewer are selectable
 * SPORT: P5-L-collab-ops
 */
export function RoleSelector({ currentRole, onSelect, disabled = false }: RoleSelectorProps) {
  const isOwner = currentRole === 'owner';

  if (isOwner) {
    return (
      <View style={styles.row}>
        <View style={[styles.pill, styles.pillOwner]}>
          <Text style={styles.pillOwnerLabel}>Owner</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {SELECTABLE_ROLES.map(({ value, label }) => {
        const selected = currentRole === value;
        return (
          <TouchableOpacity
            key={value}
            style={[styles.pill, selected ? styles.pillSelected : styles.pillUnselected]}
            onPress={() => !disabled && onSelect(value)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityLabel={`${label} role`}
            accessibilityState={{ selected, disabled }}
          >
            <Text style={[styles.pillLabel, selected ? styles.pillLabelSelected : styles.pillLabelUnselected]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  pill: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 16 },
  pillSelected: { backgroundColor: '#6366f1' },
  pillUnselected: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db' },
  pillOwner: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  pillLabel: { fontSize: 13, fontWeight: '600' },
  pillLabelSelected: { color: '#fff' },
  pillLabelUnselected: { color: '#6b7280' },
  pillOwnerLabel: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
});
