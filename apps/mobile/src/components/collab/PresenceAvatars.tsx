/**
 * Purpose: Horizontal row of overlapping 32×32 avatar circles showing active presence.
 *          Shows up to maxVisible avatars with a +N overflow bubble.
 * Inputs:  presenceUsers array (userId, displayName, avatarUrl, status),
 *          maxVisible (default 4).
 * Outputs: Renders avatar initials circles; green border = editing, gray = viewing.
 * Constraints:
 *   - No image loading — initials only (avatarUrl reserved for future img support)
 *   - Overlap via negative marginLeft of -8 on all but first item
 *   - WCAG: accessibilityLabel summarising who is present
 * SPORT: P5-L-collab-ops
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface PresenceAvatarUser {
  userId: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  status: 'viewing' | 'editing';
}

interface PresenceAvatarsProps {
  presenceUsers: PresenceAvatarUser[];
  maxVisible?: number;
}

function getInitials(displayName?: string | null, userId?: string): string {
  if (displayName) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return displayName.slice(0, 2).toUpperCase();
  }
  return (userId ?? '?').slice(0, 2).toUpperCase();
}

function getAvatarBg(userId: string): string {
  // Deterministic color from userId
  const COLORS = ['#818cf8', '#34d399', '#f472b6', '#fb923c', '#60a5fa', '#a78bfa'];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash + userId.charCodeAt(i)) % COLORS.length;
  return COLORS[hash];
}

/**
 * Purpose: Renders overlapping presence avatar circles.
 * Inputs:  presenceUsers, maxVisible
 * Outputs: Avatar row with +N overflow
 * Constraints: Initials only; border color indicates status
 * SPORT: P5-L-collab-ops
 */
export function PresenceAvatars({ presenceUsers, maxVisible = 4 }: PresenceAvatarsProps) {
  if (presenceUsers.length === 0) return null;

  const visible = presenceUsers.slice(0, maxVisible);
  const overflow = presenceUsers.length - visible.length;

  const a11yLabel = presenceUsers
    .map((u) => `${u.displayName ?? u.userId} (${u.status})`)
    .join(', ');

  return (
    <View style={styles.row} accessibilityLabel={`Present: ${a11yLabel}`}>
      {visible.map((user, index) => (
        <View
          key={user.userId}
          style={[
            styles.avatar,
            { marginLeft: index === 0 ? 0 : -8, backgroundColor: getAvatarBg(user.userId) },
            user.status === 'editing' ? styles.borderEditing : styles.borderViewing,
          ]}
          accessibilityLabel={`${user.displayName ?? user.userId} is ${user.status}`}
        >
          <Text style={styles.initials}>{getInitials(user.displayName, user.userId)}</Text>
        </View>
      ))}
      {overflow > 0 && (
        <View style={[styles.avatar, styles.overflow, { marginLeft: -8 }]}>
          <Text style={styles.overflowText}>+{overflow}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  borderEditing: { borderColor: '#22c55e' },
  borderViewing: { borderColor: '#d1d5db' },
  initials: { fontSize: 11, fontWeight: '700', color: '#fff' },
  overflow: { backgroundColor: '#e5e7eb', borderColor: '#d1d5db' },
  overflowText: { fontSize: 11, fontWeight: '700', color: '#6b7280' },
});
