/**
 * Purpose: Unit tests for HomeScreen — header, FAB, 7-state body (empty, loaded, offline banner).
 * Inputs: mocked urql useQuery; mocked useTaskMutations; mocked useNetworkState.
 * Outputs: jest assertions on rendered structure and navigation button presence.
 * Constraints: Runs under jest-expo preset; seven-states components stubbed to avoid native deps.
 * SPORT: P5-C-home-screen
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';

jest.mock('urql', () => ({
  useQuery: jest.fn(() => [{ data: null, fetching: false, error: undefined }, jest.fn()]),
  useMutation: () => [{ fetching: false }, jest.fn()],
  gql: (s: TemplateStringsArray) => s[0],
}));

// Wrapped in arrows so these resolve at call-time, not factory-creation-time —
// referencing the mockCreateList/etc consts directly here would read `undefined`
// due to jest.mock hoisting running before those consts are assigned (see
// usePushToken.test.ts for the same gotcha spelled out in full).
const mockCreateList = jest.fn();
const mockUpdateList = jest.fn();
const mockDeleteList = jest.fn();
jest.mock('../../hooks/useTaskMutations', () => ({
  useTaskMutations: () => ({
    createList: (...args: unknown[]) => mockCreateList(...args),
    updateList: (...args: unknown[]) => mockUpdateList(...args),
    deleteList: (...args: unknown[]) => mockDeleteList(...args),
  }),
}));

jest.mock('../../hooks/useNetworkState', () => ({
  useNetworkState: jest.fn(() => ({
    isConnected: true,
    isInternetReachable: true,
    wasOffline: false,
  })),
}));

jest.mock('../../lib/hasura', () => ({ GET_LISTS: 'GET_LISTS' }));

jest.mock('../../lib/validation', () => ({
  projectCreateSchema: jest.fn(() => ({
    success: true,
    data: { title: 'Test List' },
    errors: [],
  })),
}));

jest.mock('../../lib/task-error', () => ({
  classifyUrqlError: jest.fn(() => ({ type: 'server', message: 'Server error' })),
  taskUserMessage: jest.fn(() => 'Something went wrong. Please try again.'),
}));

const mockEnqueue = jest.fn().mockResolvedValue(undefined);
jest.mock('../../lib/offline-queue', () => ({
  enqueue: (...args: unknown[]) => mockEnqueue(...args),
}));

jest.mock('../../lib/idempotency', () => ({
  generateIdempotencyKey: jest.fn(() => 'idem-key-test'),
}));

// Stub seven-states components to avoid native module dependencies
jest.mock('../../components/seven-states', () => {
  const { Text, View } = require('react-native');
  return {
    EmptyState: ({ title }: { title: string }) => <Text>{title}</Text>,
    ErrorCard: ({ message }: { message: string }) => <Text>{message}</Text>,
    OfflineBanner: ({ visible }: { visible: boolean }) =>
      visible ? <Text>You are offline</Text> : null,
    PermissionDenied: () => <Text>Permission denied</Text>,
    RateLimitedCard: () => <Text>Rate limited</Text>,
    SkeletonList: () => <View testID="skeleton-list" />,
  };
});

import { useQuery } from 'urql';
import { useNetworkState } from '../../hooks/useNetworkState';
import { HomeScreen } from '../HomeScreen';

const mockNavigation = {
  navigate: jest.fn(),
  replace: jest.fn(),
  goBack: jest.fn(),
};

function renderScreen() {
  return render(
    <ThemeProvider>
      <HomeScreen
        navigation={mockNavigation as never}
        route={{ key: 'Home', name: 'Home' } as never}
      />
    </ThemeProvider>,
  );
}

const SAMPLE_LIST = { id: 'list-1', title: 'Work', color: '#6366F1', description: null };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useQuery).mockReturnValue([
    { data: { np_lists: [SAMPLE_LIST] }, fetching: false, error: undefined },
    jest.fn(),
  ] as never);
  jest.mocked(useNetworkState).mockReturnValue({
    isConnected: true,
    isInternetReachable: true,
    wasOffline: false,
  });
  mockCreateList.mockResolvedValue({});
  mockUpdateList.mockResolvedValue({});
  mockDeleteList.mockResolvedValue({});
  mockEnqueue.mockResolvedValue(undefined);
});

describe('HomeScreen', () => {
  describe('header', () => {
    it('renders header title ɳTask', () => {
      const { getByText } = renderScreen();
      expect(getByText('ɳTask')).toBeTruthy();
    });

    it('renders Smart views button in header', () => {
      const { getByLabelText } = renderScreen();
      expect(getByLabelText('Smart views')).toBeTruthy();
    });

    it('renders Settings button in header', () => {
      const { getByLabelText } = renderScreen();
      expect(getByLabelText('Settings')).toBeTruthy();
    });

    it('renders Profile button in header', () => {
      const { getByLabelText } = renderScreen();
      expect(getByLabelText('Profile')).toBeTruthy();
    });
  });

  describe('FAB', () => {
    it('renders the New list FAB button', () => {
      const { getByLabelText } = renderScreen();
      expect(getByLabelText('New list')).toBeTruthy();
    });
  });

  describe('7-state body', () => {
    it('shows EmptyState with "No lists yet" when data has empty np_lists', () => {
      jest.mocked(useQuery).mockReturnValue([
        { data: { np_lists: [] }, fetching: false, error: undefined },
        jest.fn(),
      ] as never);
      const { getByText } = renderScreen();
      expect(getByText('No lists yet')).toBeTruthy();
    });

    it('shows SkeletonList when loading and no lists', () => {
      jest.mocked(useQuery).mockReturnValue([
        { data: null, fetching: true, error: undefined },
        jest.fn(),
      ] as never);
      const { getByTestId } = renderScreen();
      expect(getByTestId('skeleton-list')).toBeTruthy();
    });

    it('renders list item titles when data has lists', () => {
      jest.mocked(useQuery).mockReturnValue([
        {
          data: {
            np_lists: [
              { id: '1', title: 'Work', color: '#6366F1', description: null },
              { id: '2', title: 'Personal', color: '#10b981', description: 'My tasks' },
            ],
          },
          fetching: false,
          error: undefined,
        },
        jest.fn(),
      ] as never);
      const { getByText } = renderScreen();
      expect(getByText('Work')).toBeTruthy();
      expect(getByText('Personal')).toBeTruthy();
    });

    it('renders list item description when present', () => {
      jest.mocked(useQuery).mockReturnValue([
        {
          data: {
            np_lists: [
              { id: '1', title: 'Work', color: '#6366F1', description: 'Daily standup' },
            ],
          },
          fetching: false,
          error: undefined,
        },
        jest.fn(),
      ] as never);
      const { getByText } = renderScreen();
      expect(getByText('Daily standup')).toBeTruthy();
    });
  });

  describe('list mutations — error handling (FIX 3)', () => {
    it('shows an alert and does not crash when createList fails', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      mockCreateList.mockResolvedValue({ error: new Error('boom') });
      const { getByLabelText } = renderScreen();

      fireEvent.press(getByLabelText('New list'));
      fireEvent.changeText(getByLabelText('List name'), 'New List');
      fireEvent.press(getByLabelText('Create list'));

      await waitFor(() => expect(mockCreateList).toHaveBeenCalled());
      expect(alertSpy).toHaveBeenCalledWith('List not saved', 'Something went wrong. Please try again.');
      alertSpy.mockRestore();
    });

    it('shows an alert when updateList (rename) fails', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      mockUpdateList.mockResolvedValue({ error: new Error('boom') });
      const { getByLabelText } = renderScreen();

      fireEvent(getByLabelText('Work'), 'longPress');
      const sheetButtons = alertSpy.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
      act(() => { sheetButtons.find((b) => b.text === 'Rename')!.onPress!(); });

      fireEvent.changeText(getByLabelText('List name'), 'Renamed');
      fireEvent.press(getByLabelText('Save list name'));

      await waitFor(() => expect(mockUpdateList).toHaveBeenCalledWith('list-1', { title: 'Renamed' }));
      expect(alertSpy).toHaveBeenCalledWith('List not saved', 'Something went wrong. Please try again.');
      alertSpy.mockRestore();
    });

    it('shows an alert when deleteList fails', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      mockDeleteList.mockResolvedValue({ error: new Error('boom') });
      const { getByLabelText } = renderScreen();

      fireEvent(getByLabelText('Work'), 'longPress');
      const sheetButtons = alertSpy.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
      sheetButtons.find((b) => b.text === 'Delete')!.onPress!();

      const confirmButtons = alertSpy.mock.calls[1][2] as Array<{ text: string; onPress?: () => Promise<void> }>;
      await confirmButtons.find((b) => b.text === 'Delete')!.onPress!();

      expect(mockDeleteList).toHaveBeenCalledWith('list-1');
      expect(alertSpy).toHaveBeenCalledWith('List not deleted', 'Something went wrong. Please try again.');
      alertSpy.mockRestore();
    });
  });

  describe('list mutations — offline queue (FIX 4)', () => {
    beforeEach(() => {
      jest.mocked(useNetworkState).mockReturnValue({
        isConnected: false,
        isInternetReachable: false,
        wasOffline: true,
      });
    });

    it('enqueues create_list instead of calling createList when offline', async () => {
      const { getByLabelText } = renderScreen();

      fireEvent.press(getByLabelText('New list'));
      fireEvent.changeText(getByLabelText('List name'), 'New List');
      fireEvent.press(getByLabelText('Create list'));

      await waitFor(() =>
        expect(mockEnqueue).toHaveBeenCalledWith(
          'create_list',
          expect.objectContaining({ title: 'Test List' }),
          expect.any(String),
        ),
      );
      expect(mockCreateList).not.toHaveBeenCalled();
    });

    it('enqueues update_list instead of calling updateList when offline', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const { getByLabelText } = renderScreen();

      fireEvent(getByLabelText('Work'), 'longPress');
      const sheetButtons = alertSpy.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
      act(() => { sheetButtons.find((b) => b.text === 'Rename')!.onPress!(); });

      fireEvent.changeText(getByLabelText('List name'), 'Renamed');
      fireEvent.press(getByLabelText('Save list name'));

      await waitFor(() =>
        expect(mockEnqueue).toHaveBeenCalledWith(
          'update_list',
          { id: 'list-1', fields: { title: 'Renamed' } },
          expect.any(String),
        ),
      );
      expect(mockUpdateList).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });

    it('enqueues delete_list instead of calling deleteList when offline', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const { getByLabelText } = renderScreen();

      fireEvent(getByLabelText('Work'), 'longPress');
      const sheetButtons = alertSpy.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
      sheetButtons.find((b) => b.text === 'Delete')!.onPress!();

      const confirmButtons = alertSpy.mock.calls[1][2] as Array<{ text: string; onPress?: () => Promise<void> }>;
      await confirmButtons.find((b) => b.text === 'Delete')!.onPress!();

      expect(mockEnqueue).toHaveBeenCalledWith('delete_list', { id: 'list-1' }, expect.any(String));
      expect(mockDeleteList).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });
  });

  describe('offline banner', () => {
    it('shows offline banner text when isConnected=false', () => {
      jest.mocked(useNetworkState).mockReturnValue({
        isConnected: false,
        isInternetReachable: false,
        wasOffline: true,
      });
      const { getByText } = renderScreen();
      expect(getByText('You are offline')).toBeTruthy();
    });

    it('does not show offline banner when isConnected=true', () => {
      const { queryByText } = renderScreen();
      expect(queryByText('You are offline')).toBeNull();
    });
  });
});
