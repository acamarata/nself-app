/**
 * Purpose: Lists all active sessions for the current user with revoke capability.
 * Inputs: useSessions (query), useAccountMutations.revokeSession (mutation).
 * Outputs: Revokes individual sessions; removes revoked rows from local state.
 * Constraints: ≤250L. Free plugins only. Cannot revoke isCurrent session.
 * SPORT: P5-J-sessions-screen
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  Alert, StyleSheet, RefreshControl,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useSessions } from '../hooks/useAccount';
import { useAccountMutations } from '../hooks/useAccount';
import type { Session } from '../lib/accountOps';

type Props = NativeStackScreenProps<RootStackParamList, 'Sessions'>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a human-readable relative time string from an ISO timestamp. */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return 'just now';
  if (hours < 1)  return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  if (days < 1)   return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** Picks a text icon based on the device name heuristic. */
function deviceIcon(name: string | undefined): string {
  if (!name) return '🖥';
  const n = name.toLowerCase();
  if (n.includes('iphone') || n.includes('android') || n.includes('mobile') || n.includes('pixel')) return '📱';
  return '💻';
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export function SessionsScreen({ navigation }: Props) {
  const { sessions, fetching, error, refetch } = useSessions();
  const { revokeSession } = useAccountMutations();

  // Track locally revoked IDs so the row disappears immediately on success.
  const [revokedIds, setRevokedIds]     = useState<Set<string>>(new Set());
  const [revoking, setRevoking]         = useState<string | null>(null);
  const [successId, setSuccessId]       = useState<string | null>(null);

  const visibleSessions = sessions.filter(s => !revokedIds.has(s.id));

  const handleRevoke = useCallback((session: Session) => {
    const name = session.deviceName ?? 'this device';
    Alert.alert(
      'End this session?',
      `"${name}" will be signed out immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            setRevoking(session.id);
            try {
              await revokeSession(session.id);
              setRevokedIds(prev => new Set(prev).add(session.id));
              setSuccessId(session.id);
              // Clear toast badge after 2 s
              setTimeout(() => setSuccessId(null), 2000);
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Could not revoke session');
            } finally {
              setRevoking(null);
            }
          },
        },
      ],
    );
  }, [revokeSession]);

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  const renderContent = () => {
    if (fetching && sessions.length === 0) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Could not load sessions</Text>
          <Text style={styles.errorSub}>{error.message}</Text>
          <TouchableOpacity onPress={refetch} style={styles.retryBtn} accessibilityLabel="Retry loading sessions" accessibilityRole="button">
            <Text style={styles.retryLabel}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (visibleSessions.length === 0 && !fetching) {
      return (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🖥</Text>
          <Text style={styles.emptyTitle}>No other sessions</Text>
          <Text style={styles.emptySub}>You're only signed in on this device.</Text>
        </View>
      );
    }

    return (
      <FlatList<Session>
        data={visibleSessions}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={fetching} onRefresh={refetch} tintColor="#6366F1" />
        }
        renderItem={({ item }) => (
          <SessionRow
            session={item}
            isRevoking={revoking === item.id}
            showSuccess={successId === item.id}
            onRevoke={() => handleRevoke(item)}
          />
        )}
      />
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back" accessibilityRole="button">
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Active sessions</Text>
        <View style={{ width: 60 }} />
      </View>

      {renderContent()}
    </View>
  );
}

// ---------------------------------------------------------------------------
// SessionRow
// ---------------------------------------------------------------------------

interface SessionRowProps {
  session: Session;
  isRevoking: boolean;
  showSuccess: boolean;
  onRevoke: () => void;
}

function SessionRow({ session, isRevoking, showSuccess, onRevoke }: SessionRowProps) {
  const name      = session.deviceName ?? 'Unknown device';
  const lastSeen  = relativeTime(session.lastSeenAt ?? session.createdAt);

  return (
    <View style={styles.row}>
      <Text style={styles.deviceIcon}>{deviceIcon(session.deviceName ?? undefined)}</Text>
      <View style={styles.rowBody}>
        <View style={styles.rowNameLine}>
          <Text style={styles.deviceName}>{name}</Text>
          {session.isCurrent && <View style={styles.badge}><Text style={styles.badgeText}>This device</Text></View>}
        </View>
        <Text style={styles.lastSeen}>Last seen {lastSeen}</Text>
      </View>

      {!session.isCurrent && (
        showSuccess ? (
          <Text style={styles.revokedBadge}>Revoked</Text>
        ) : (
          <TouchableOpacity
            style={[styles.revokeBtn, isRevoking && styles.revokeBtnDisabled]}
            onPress={onRevoke}
            disabled={isRevoking}
            accessibilityLabel={`Revoke session from ${name}`}
            accessibilityRole="button"
          >
            {isRevoking
              ? <ActivityIndicator size="small" color="#DC2626" />
              : <Text style={styles.revokeBtnText}>Revoke</Text>}
          </TouchableOpacity>
        )
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#F9FAFB' },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  back:            { fontSize: 16, color: '#6366F1', width: 60 },
  title:           { fontSize: 17, fontWeight: '700', color: '#111827' },
  list:            { padding: 16, gap: 8 },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon:       { fontSize: 48, marginBottom: 12 },
  emptyTitle:      { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 6 },
  emptySub:        { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  errorCard:       { margin: 16, padding: 20, backgroundColor: '#FFF', borderRadius: 12, alignItems: 'center', gap: 6 },
  errorTitle:      { fontSize: 15, fontWeight: '700', color: '#DC2626' },
  errorSub:        { fontSize: 13, color: '#6B7280', textAlign: 'center' },
  retryBtn:        { marginTop: 8, paddingVertical: 8, paddingHorizontal: 20, backgroundColor: '#F3F4F6', borderRadius: 8 },
  retryLabel:      { fontSize: 14, fontWeight: '600', color: '#6366F1' },
  row:             { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  deviceIcon:      { fontSize: 24, marginEnd: 12 },
  rowBody:         { flex: 1, gap: 2 },
  rowNameLine:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deviceName:      { fontSize: 15, fontWeight: '600', color: '#111827' },
  badge:           { paddingHorizontal: 7, paddingVertical: 2, backgroundColor: '#EEF2FF', borderRadius: 20 },
  badgeText:       { fontSize: 11, fontWeight: '600', color: '#6366F1' },
  lastSeen:        { fontSize: 12, color: '#6B7280' },
  revokeBtn:       { borderWidth: 1, borderColor: '#DC2626', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, minWidth: 66, alignItems: 'center' },
  revokeBtnDisabled: { opacity: 0.5 },
  revokeBtnText:   { fontSize: 13, fontWeight: '600', color: '#DC2626' },
  revokedBadge:    { fontSize: 12, fontWeight: '600', color: '#10B981' },
});
