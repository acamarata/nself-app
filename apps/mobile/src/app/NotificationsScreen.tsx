/**
 * Purpose: Notification centre screen — newest-first list of np_notifications for
 *          the signed-in user, unread rows visually distinct, with web-parity
 *          mark-read behaviour (same mutations the web popover issues).
 * Inputs:  useNotifications (GET_NOTIFICATIONS + unread aggregate + mark-read
 *          mutations); navigation to TaskDetail/List via resolveNotificationTarget.
 * Outputs: Stack screen "Notifications": back header with "mark all read",
 *          seven-state body (SkeletonList / ErrorCard / EmptyState / FlatList).
 * Constraints:
 *   - Tapping a row marks it read; if its action_url resolves to a known screen
 *     (task/list deep link or web-style /tasks/:id path) it also navigates there.
 *     Unresolvable URLs only mark read — no invented routes.
 *   - Row tap must stay responsive: markRead fires async, navigation is not
 *     awaited on it.
 *   - Unread styling = primarySubtle row tint + primary unread dot; read rows
 *     use surfaceElevated (mirrors the web indigo tint + dot).
 * SPORT: MB-2 notification centre on mobile (web parity)
 */

import React from 'react';
import {
  FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useNotifications } from '../hooks/useNotifications';
import { resolveNotificationTarget } from '../lib/notificationLinks';
import {
  relativeTime, typeGlyph, type NotificationRow,
} from '../lib/notifications';
import {
  EmptyState, ErrorCard, SkeletonList,
} from '../components/seven-states';
import { classifyUrqlError, taskUserMessage } from '../lib/task-error';
import { useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

export function NotificationsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { notifications, unreadCount, loading, error, refetch, markRead, markAllRead } =
    useNotifications();

  const handlePress = (notif: NotificationRow) => {
    if (!notif.read) void markRead(notif.id);
    const target = notif.action_url ? resolveNotificationTarget(notif.action_url) : null;
    if (target?.screen === 'TaskDetail') navigation.navigate('TaskDetail', target.params);
    else if (target?.screen === 'List') navigation.navigate('List', target.params);
  };

  const renderRow = ({ item }: { item: NotificationRow }) => (
    <TouchableOpacity
      testID={`notification-row-${item.id}`}
      onPress={() => handlePress(item)}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      style={[
        styles.row,
        { backgroundColor: item.read ? colors.surfaceElevated : colors.primarySubtle },
      ]}
    >
      <View style={[styles.glyph, { backgroundColor: colors.surface }]}>
        <Text style={styles.glyphText}>{typeGlyph(item.type)}</Text>
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.rowBody, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.body}
        </Text>
        <Text style={[styles.rowTime, { color: colors.textTertiary }]}>
          {relativeTime(item.created_at, t)}
        </Text>
      </View>
      {!item.read ? (
        <View testID={`notification-unread-dot-${item.id}`} style={[styles.dot, { backgroundColor: colors.primary }]} />
      ) : null}
    </TouchableOpacity>
  );

  const renderBody = () => {
    if (loading && notifications.length === 0) return <SkeletonList rows={8} rowHeight={72} />;
    if (error) {
      const taskErr = classifyUrqlError(error);
      return <ErrorCard message={taskUserMessage(taskErr)} onRetry={refetch} />;
    }
    if (notifications.length === 0) {
      return <EmptyState icon="🔔" title={t('screens:notifications.empty')} />;
    }
    return (
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.primary} />
        }
        renderItem={renderRow}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surfaceElevated, borderBottomColor: colors.borderSubtle },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('common:back')}
        >
          <Text style={[styles.back, { color: colors.primary }]}>‹ {t('common:back')}</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{t('screens:notifications.title')}</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity
            onPress={() => void markAllRead()}
            accessibilityRole="button"
            accessibilityLabel={t('screens:notifications.markAllRead')}
          >
            <Text style={[styles.markAll, { color: colors.primary }]}>
              {t('screens:notifications.markAllRead')}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backSpacer} />
        )}
      </View>

      <View style={styles.body}>{renderBody()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  back: { fontSize: 16, width: 80 },
  backSpacer: { width: 80 },
  title: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  markAll: { fontSize: 13, fontWeight: '600', width: 80, textAlign: 'right' },
  body: { flex: 1 },
  listContent: { padding: 16, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  glyph: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphText: { fontSize: 15 },
  rowContent: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowBody: { fontSize: 13 },
  rowTime: { fontSize: 11, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
});
