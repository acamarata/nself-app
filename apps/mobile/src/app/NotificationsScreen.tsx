/**
 * Purpose: Notifications center — shows a list of recent in-app notifications.
 * For now this is a placeholder screen (push integration is C-S6-T2).
 * Constraints: ≤150L. Shows empty state when no notifications.
 * SPORT: C-S3 (nav screen)
 */
import React from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

interface AppNotification {
  id: string;
  type: 'comment' | 'assigned' | 'due';
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

const NOTIFICATION_ICONS: Record<AppNotification['type'], string> = {
  comment: '💬',
  assigned: '📋',
  due: '⏰',
};

export function NotificationsScreen({ navigation }: Props) {
  // Future: fetch from np_notifications table (Epic A). For now, local state.
  const notifications: AppNotification[] = [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back" accessibilityRole="button">
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 60 }} />
      </View>

      {notifications.length === 0 ? (
        <View style={styles.empty} accessibilityLiveRegion="polite">
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyTitle}>No notifications</Text>
          <Text style={styles.emptyHint}>You're all caught up!</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          accessibilityLiveRegion="polite"
          renderItem={({ item }) => (
            <View style={[styles.notifRow, !item.read && styles.notifRowUnread]}>
              <Text style={styles.notifIcon}>{NOTIFICATION_ICONS[item.type]}</Text>
              <View style={styles.notifContent}>
                <Text style={styles.notifTitle}>{item.title}</Text>
                <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  back: { fontSize: 16, color: '#6366F1', width: 60 },
  title: { fontSize: 17, fontWeight: '700', color: '#111827' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  emptyHint: { fontSize: 14, color: '#6B7280' },
  notifRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 12, backgroundColor: '#FFF' },
  notifRowUnread: { backgroundColor: '#EEF2FF' },
  notifIcon: { fontSize: 22, marginTop: 2 },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  notifBody: { fontSize: 13, color: '#6B7280', marginTop: 2 },
});
