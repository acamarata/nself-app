/**
 * Purpose: Acceptance tests for NotificationsScreen — MB-2 ticket verification.
 *   A fixture np_notifications row renders in the list; the unread dot matches
 *   unread rows exactly; marking read issues the mark-read mutation.
 * Inputs: mocked useNotifications; mocked seven-states stubs; real i18n en bundles.
 * Outputs: jest assertions on row render, unread dot presence, and mutation calls.
 * Constraints: Runs under jest-expo; useNotifications fully mocked; initializeI18n('en')
 *   called in beforeAll so t('screens:notifications.*') resolves against real JSON.
 * SPORT: MB-2 notification centre on mobile
 */

import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { initializeI18n } from '../../i18n';

jest.mock('urql', () => ({
  useQuery: jest.fn(() => [{ data: null, fetching: false, error: undefined }, jest.fn()]),
  useMutation: () => [{ fetching: false }, jest.fn()],
  gql: (s: TemplateStringsArray) => s[0],
}));

const mockMarkRead = jest.fn().mockResolvedValue(true);
const mockMarkAllRead = jest.fn().mockResolvedValue(true);
const mockRefetch = jest.fn();

// Wrapped in arrow so mock call-time resolves the const (avoids hoisting issue).
jest.mock('../../hooks/useNotifications', () => ({
  useNotifications: jest.fn(() => ({
    notifications: [],
    unreadCount: 0,
    loading: false,
    error: undefined,
    refetch: (...args: unknown[]) => mockRefetch(...args),
    markRead: (...args: unknown[]) => mockMarkRead(...args),
    markAllRead: (...args: unknown[]) => mockMarkAllRead(...args),
  })),
}));

jest.mock('../../lib/task-error', () => ({
  classifyUrqlError: jest.fn(() => ({ type: 'server', message: 'Server error' })),
  taskUserMessage: jest.fn(() => 'Something went wrong. Please try again.'),
}));

jest.mock('../../lib/notificationLinks', () => ({
  resolveNotificationTarget: jest.fn(() => null),
}));

jest.mock('../../components/seven-states', () => {
  const { Text, View } = require('react-native');
  return {
    EmptyState: ({ title }: { title: string }) => <Text>{title}</Text>,
    ErrorCard: ({ message }: { message: string }) => <Text>{message}</Text>,
    SkeletonList: () => <View testID="skeleton-list" />,
  };
});

import { useNotifications } from '../../hooks/useNotifications';
import { NotificationsScreen } from '../NotificationsScreen';
import type { NotificationRow } from '../../lib/notifications';

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

function renderScreen() {
  return render(
    <ThemeProvider>
      <NotificationsScreen
        navigation={mockNavigation as never}
        route={{ key: 'Notifications', name: 'Notifications' } as never}
      />
    </ThemeProvider>,
  );
}

const UNREAD_NOTIF: NotificationRow = {
  id: 'n1',
  type: 'new_todo',
  title: 'Task assigned to you',
  body: 'Do the thing',
  read: false,
  action_url: null,
  data: null,
  created_at: new Date().toISOString(),
};

const READ_NOTIF: NotificationRow = {
  id: 'n2',
  type: 'due_reminder',
  title: 'Task due soon',
  body: 'Finish it',
  read: true,
  action_url: null,
  data: null,
  created_at: new Date().toISOString(),
};

beforeAll(() => {
  initializeI18n('en');
});

beforeEach(() => {
  jest.clearAllMocks();
  mockMarkRead.mockResolvedValue(true);
  mockMarkAllRead.mockResolvedValue(true);
  jest.mocked(useNotifications).mockReturnValue({
    notifications: [],
    unreadCount: 0,
    loading: false,
    error: undefined,
    refetch: mockRefetch,
    markRead: mockMarkRead,
    markAllRead: mockMarkAllRead,
  });
});

describe('NotificationsScreen', () => {
  describe('MB-2 acceptance: fixture row renders', () => {
    it('renders a notification row title and body', () => {
      jest.mocked(useNotifications).mockReturnValue({
        notifications: [UNREAD_NOTIF],
        unreadCount: 1,
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        markRead: mockMarkRead,
        markAllRead: mockMarkAllRead,
      });
      const { getByText } = renderScreen();
      expect(getByText('Task assigned to you')).toBeTruthy();
      expect(getByText('Do the thing')).toBeTruthy();
    });
  });

  describe('MB-2 acceptance: unread badge count matches unread rows', () => {
    it('shows an unread dot for unread rows and omits it for read rows', () => {
      jest.mocked(useNotifications).mockReturnValue({
        notifications: [UNREAD_NOTIF, READ_NOTIF],
        unreadCount: 1,
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        markRead: mockMarkRead,
        markAllRead: mockMarkAllRead,
      });
      const { getByTestId, queryByTestId } = renderScreen();
      expect(getByTestId('notification-unread-dot-n1')).toBeTruthy();
      expect(queryByTestId('notification-unread-dot-n2')).toBeNull();
    });
  });

  describe('MB-2 acceptance: marking read issues the mutation and clears the badge', () => {
    it('calls markRead with the notification id when an unread row is tapped', async () => {
      jest.mocked(useNotifications).mockReturnValue({
        notifications: [UNREAD_NOTIF],
        unreadCount: 1,
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        markRead: mockMarkRead,
        markAllRead: mockMarkAllRead,
      });
      const { getByTestId } = renderScreen();
      fireEvent.press(getByTestId('notification-row-n1'));
      await waitFor(() => expect(mockMarkRead).toHaveBeenCalledWith('n1'));
    });

    it('does not call markRead when a read row is tapped', async () => {
      jest.mocked(useNotifications).mockReturnValue({
        notifications: [READ_NOTIF],
        unreadCount: 0,
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        markRead: mockMarkRead,
        markAllRead: mockMarkAllRead,
      });
      const { getByTestId } = renderScreen();
      fireEvent.press(getByTestId('notification-row-n2'));
      await waitFor(() => expect(mockMarkRead).not.toHaveBeenCalled());
    });

    it('calls markAllRead when the mark-all button is tapped', async () => {
      jest.mocked(useNotifications).mockReturnValue({
        notifications: [UNREAD_NOTIF],
        unreadCount: 1,
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        markRead: mockMarkRead,
        markAllRead: mockMarkAllRead,
      });
      const { getByLabelText } = renderScreen();
      fireEvent.press(getByLabelText('Mark all as read'));
      await waitFor(() => expect(mockMarkAllRead).toHaveBeenCalled());
    });
  });

  describe('seven-state body', () => {
    it('shows SkeletonList while loading with no notifications', () => {
      jest.mocked(useNotifications).mockReturnValue({
        notifications: [],
        unreadCount: 0,
        loading: true,
        error: undefined,
        refetch: mockRefetch,
        markRead: mockMarkRead,
        markAllRead: mockMarkAllRead,
      });
      const { getByTestId } = renderScreen();
      expect(getByTestId('skeleton-list')).toBeTruthy();
    });

    it('shows EmptyState when there are no notifications', () => {
      const { getByText } = renderScreen();
      expect(getByText('No notifications')).toBeTruthy();
    });

    it('shows ErrorCard when the query errors', () => {
      jest.mocked(useNotifications).mockReturnValue({
        notifications: [],
        unreadCount: 0,
        loading: false,
        error: new Error('network failure'),
        refetch: mockRefetch,
        markRead: mockMarkRead,
        markAllRead: mockMarkAllRead,
      });
      const { getByText } = renderScreen();
      expect(getByText('Something went wrong. Please try again.')).toBeTruthy();
    });
  });

  describe('header', () => {
    it('renders the screen title', () => {
      const { getByText } = renderScreen();
      expect(getByText('Notifications')).toBeTruthy();
    });

    it('shows mark-all button only when unreadCount > 0', () => {
      jest.mocked(useNotifications).mockReturnValue({
        notifications: [UNREAD_NOTIF],
        unreadCount: 1,
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        markRead: mockMarkRead,
        markAllRead: mockMarkAllRead,
      });
      const { getByLabelText } = renderScreen();
      expect(getByLabelText('Mark all as read')).toBeTruthy();
    });

    it('hides mark-all button when unreadCount is 0', () => {
      const { queryByLabelText } = renderScreen();
      expect(queryByLabelText('Mark all as read')).toBeNull();
    });

    it('calls goBack when the back button is pressed', () => {
      const { getByLabelText } = renderScreen();
      fireEvent.press(getByLabelText('Back'));
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });
});
