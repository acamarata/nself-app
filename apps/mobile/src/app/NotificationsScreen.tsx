/**
 * Purpose: Notifications center — shows a list of recent in-app notifications.
 * For now this is a placeholder screen (push integration is C-S6-T2).
 * Constraints: ≤150L. Shows empty state when no notifications.
 * SPORT: C-S3 (nav screen)
 */
import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useTheme } from '../theme';

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
  const { colors } = useTheme();
  // Future: fetch from np_notifications table (Epic A). For now, local state.
  const notifications: AppNotification[] = [];

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surfaceElevated, borderBottomColor: colors.borderSubtle }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back" accessibilityRole="button">
          <Text style={[styles.back, { color: colors.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
        <View style={{ width: 60 }} />
      </View>

      {notifications.length === 0 ? (
        <View style={styles.empty} accessibilityLiveRegion="polite">
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No notifications</Text>
          <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>You're all caught up!</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          accessibilityLiveRegion="polite"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={item.title}
              style={[
                styles.notifRow,
                { backgroundColor: item.read ? colors.surfaceElevated : colors.primarySubtle, borderBottomColor: colors.borderSubtle },
              ]}
            >
              <Text style={styles.notifIcon}>{NOTIFICATION_ICONS[item.type]}</Text>
              <View style={styles.notifContent}>
                <Text style={[styles.notifTitle, { color: colors.text }]}>{item.title}</Text>
                <Text style={[styles.notifBody, { color: colors.textSecondary }]} numberOfLines={2}>{item.body}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 14, borderBottomWidth: 1 },
  back: { fontSize: 16, width: 60 },
  title: { fontSize: 17, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyHint: { fontSize: 14 },
  notifRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, borderBottomWidth: 1, gap: 12 },
  notifIcon: { fontSize: 22, marginTop: 2 },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 14, fontWeight: '600' },
  notifBody: { fontSize: 13, marginTop: 2 },
});
