/**
 * Purpose: Renders a single list member row — avatar with initials, presence dot,
 *          display name, role badge, and optional inline role picker when expanded.
 * Inputs:  ListMember, presence state, owner flag, expanded state, callbacks.
 * Outputs: Touchable row; fires onLongPress for action sheet, onRoleSelect for role change.
 * Constraints:
 *   - Long-press only active when isOwner=true and member is not self
 *   - Presence dot: green border = editing, gray = viewing
 *   - RoleSelector shown inline when expandedId === member.id
 * SPORT: P5-L-collab-ops
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { ListMember } from '../../lib/collabOps';
import { RoleSelector } from './RoleSelector';
import { useTheme } from '../../theme';

interface MemberRowProps {
  member: ListMember;
  isPresent: boolean;
  presenceStatus?: 'viewing' | 'editing';
  isOwner: boolean;
  currentUserId: string;
  onLongPress: (member: ListMember) => void;
  onRoleSelect: (member: ListMember, role: string) => void;
  expandedId: string | null;
}

function getInitials(displayName: string | null | undefined, userId: string): string {
  if (displayName) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return displayName.slice(0, 2).toUpperCase();
  }
  return userId.slice(0, 2).toUpperCase();
}

function roleBadgeColor(role: string): string {
  switch (role) {
    case 'owner': return '#6366f1';
    case 'admin': return '#0ea5e9';
    case 'editor': return '#22c55e';
    default: return '#9ca3af';
  }
}

/**
 * Purpose: Single member row for the ListMembersScreen.
 * Inputs:  MemberRowProps
 * Outputs: Touchable member row with avatar, name, role, presence dot
 * Constraints: Long-press disabled for self; RoleSelector shown when expandedId matches
 * SPORT: P5-L-collab-ops
 */
export function MemberRow({
  member, isPresent, presenceStatus, isOwner, currentUserId,
  onLongPress, onRoleSelect, expandedId,
}: MemberRowProps) {
  const { colors } = useTheme();
  const isSelf = member.user_id === currentUserId;
  const displayName = member.profile?.display_name;
  const initials = getInitials(displayName, member.user_id);
  const expanded = expandedId === member.id;

  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: colors.surfaceElevated, borderBottomColor: colors.borderSubtle }]}
      onLongPress={() => isOwner && !isSelf ? onLongPress(member) : undefined}
      accessibilityLabel={`${displayName ?? member.user_id}, ${member.role}${isPresent ? ', present' : ''}`}
      accessibilityRole="button"
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarInitials}>{initials}</Text>
        {isPresent && (
          <View style={[
            styles.presenceDot,
            { borderColor: colors.surfaceElevated },
            presenceStatus === 'editing' ? styles.dotEditing : styles.dotViewing,
          ]} />
        )}
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {displayName ?? member.user_id}{isSelf ? ' (you)' : ''}
        </Text>
        <View style={[styles.badge, { backgroundColor: roleBadgeColor(member.role) }]}>
          <Text style={styles.badgeText}>{member.role}</Text>
        </View>
      </View>
      {expanded && isOwner && member.role !== 'owner' && (
        <RoleSelector currentRole={member.role} onSelect={(r) => onRoleSelect(member, r)} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#818cf8', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarInitials: { fontSize: 14, fontWeight: '700', color: '#fff' },
  presenceDot: { position: 'absolute', bottom: 0, right: 0, width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
  dotEditing: { backgroundColor: '#22c55e' },
  dotViewing: { backgroundColor: '#9ca3af' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  badge: { alignSelf: 'flex-start', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#fff' },
});
