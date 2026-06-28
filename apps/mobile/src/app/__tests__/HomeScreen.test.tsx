/**
 * Purpose: Unit tests for HomeScreen — header, FAB, 7-state body (empty, loaded, offline banner).
 * Inputs: mocked urql useQuery; mocked useTaskMutations; mocked useNetworkState.
 * Outputs: jest assertions on rendered structure and navigation button presence.
 * Constraints: Runs under jest-expo preset; seven-states components stubbed to avoid native deps.
 * SPORT: P5-C-home-screen
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';

jest.mock('urql', () => ({
  useQuery: jest.fn(() => [{ data: null, fetching: false, error: undefined }, jest.fn()]),
  useMutation: () => [{ fetching: false }, jest.fn()],
  gql: (s: TemplateStringsArray) => s[0],
}));

jest.mock('../../hooks/useTaskMutations', () => ({
  useTaskMutations: () => ({
    createList: jest.fn(),
    updateList: jest.fn(),
    deleteList: jest.fn(),
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

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useQuery).mockReturnValue([
    { data: null, fetching: false, error: undefined },
    jest.fn(),
  ] as never);
  jest.mocked(useNetworkState).mockReturnValue({
    isConnected: true,
    isInternetReachable: true,
    wasOffline: false,
  });
});

describe('HomeScreen', () => {
  describe('header', () => {
    it('renders header title ɳTask', () => {
      const { getByText } = renderScreen();
      expect(getByText('ɳTask')).toBeTruthy();
    });

    it('renders Notifications button in header', () => {
      const { getByLabelText } = renderScreen();
      expect(getByLabelText('Notifications')).toBeTruthy();
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
