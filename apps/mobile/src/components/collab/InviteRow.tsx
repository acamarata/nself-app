/**
 * Purpose: Renders a single pending invite row in the ListMembersScreen invites section.
 *          Shows email, role, status, and action buttons (accept/decline for invitee;
 *          revoke for list owner).
 * Inputs:  ListInvite, isOwner flag, accept/decline/revoke callbacks.
 * Outputs: Touchable row with action buttons.
 * Constraints:
 *   - Accept/Decline shown when current user is the invitee (not owner) and invite is pending
 *   - Revoke shown when isOwner=true and invite is pending
 * SPORT: P5-L-collab-ops
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { ListInvite } from '../../lib/collabOps';

interface InviteRowProps {
  invite: ListInvite;
  isOwner: boolean;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onRevoke: (id: string) => void;
}

/**
 * Purpose: Single pending invite row with context-aware action buttons.
 * Inputs:  InviteRowProps
 * Outputs: Invite row with email, role, status, and accept/decline/revoke buttons
 * Constraints: Revoke = owner action; accept/decline = invitee action
 * SPORT: P5-L-collab-ops
 */
export function InviteRow({ invite, isOwner, onAccept, onDecline, onRevoke }: InviteRowProps) {
  const isPending = invite.status === 'pending';
  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.email} numberOfLines={1}>{invite.email}</Text>
        <Text style={styles.meta}>{invite.status} · {invite.role}</Text>
      </View>
      {isPending && (
        <View style={styles.actions}>
          {!isOwner ? (
            <>
              <TouchableOpacity onPress={() => onAccept(invite.id)} accessibilityLabel="Accept invite" style={styles.btn}>
                <Text style={styles.accept}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onDecline(invite.id)} accessibilityLabel="Decline invite" style={styles.btn}>
                <Text style={styles.decline}>Decline</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity onPress={() => onRevoke(invite.id)} accessibilityLabel="Revoke invite" style={styles.btn}>
              <Text style={styles.decline}>Revoke</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  info: { flex: 1 },
  email: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 4 },
  meta: { fontSize: 12, color: '#9ca3af' },
  actions: { flexDirection: 'row', gap: 8 },
  btn: { paddingVertical: 4, paddingHorizontal: 10 },
  accept: { fontSize: 13, color: '#22c55e', fontWeight: '600' },
  decline: { fontSize: 13, color: '#ef4444', fontWeight: '600' },
});
