/**
 * Purpose: Resolve an np_notifications.action_url into a mobile navigation
 *          target. The backend writes web-style paths (todo-assigned inserts
 *          "/tasks/<uuid>"), while the app's own deep links use ntask://task/:id —
 *          this maps both onto the existing screens instead of inventing a new
 *          navigation scheme.
 * Inputs:  action_url string as stored on the np_notifications row.
 * Outputs: { screen: 'TaskDetail' | 'List', params } matching RootStackParamList,
 *          or null when the URL does not name a resolvable route (the caller
 *          then only marks the notification read).
 * Constraints: Segment logic mirrors parseDeepLink in app/index.tsx (scheme and
 *          host are stripped, first segment names the resource); additionally
 *          accepts the plural "tasks"/"lists" forms the backend writes. Pure and
 *          total — never throws.
 * SPORT: MB-2 notification centre on mobile
 */

export type NotificationTarget =
  | { screen: 'TaskDetail'; params: { taskId: string; listId: string } }
  | { screen: 'List'; params: { listId: string; listTitle: string } };

export function resolveNotificationTarget(actionUrl: string): NotificationTarget | null {
  try {
    const stripped = actionUrl
      .replace(/^ntask:\/\//, '')
      .replace(/^https?:\/\/task\.nself\.org/, '')
      .split('?')[0] ?? '';
    const segments = stripped.split('/').filter(Boolean);
    const resource = segments[0] ?? '';
    const id = segments[1];
    if (!id) return null;
    if (resource === 'task' || resource === 'tasks') {
      return { screen: 'TaskDetail', params: { taskId: id, listId: '' } };
    }
    if (resource === 'list' || resource === 'lists') {
      return { screen: 'List', params: { listId: id, listTitle: '' } };
    }
    return null;
  } catch {
    return null;
  }
}
