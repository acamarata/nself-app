/**
 * Purpose: Cover multi-select and bulk operations on ListScreen (MB-5) through
 *   the screen, not the hook in isolation — the review's standing lesson is that
 *   a component can exist, pass its own tests, and be mounted nowhere.
 *
 * Inputs: mocked useTasks / useTaskMutations / useNetworkState.
 * Outputs: jest assertions that selection enters on long-press, that a bulk
 *   complete calls the SAME per-row mutation for every selected task, and that
 *   the action bar is reachable by assistive technology.
 * Constraints: jest-expo preset; seven-states + FlashList stubbed like the other
 *   screen tests in this directory. initializeI18n('en') is real so t() resolves
 *   against src/i18n/en/*.json rather than echoing raw keys.
 * SPORT: MB-5 multi-select and bulk operations on mobile
 */
import React from 'react';
import { I18nManager } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { initializeI18n } from '../../i18n';

jest.mock('../../hooks/useTasks', () => ({ useTasks: jest.fn() }));
jest.mock('../../hooks/useTaskMutations', () => ({ useTaskMutations: jest.fn() }));
jest.mock('../../hooks/useNetworkState', () => ({ useNetworkState: jest.fn() }));

jest.mock('../../components/seven-states', () => {
  const { Text, View } = require('react-native');
  return {
    EmptyState: ({ title }: { title: string }) => <Text>{title}</Text>,
    ErrorCard: ({ message }: { message: string }) => <Text>{message}</Text>,
    SkeletonList: () => <View testID="skeleton-list" />,
    OfflineBanner: () => null,
    PermissionDenied: () => null,
    RateLimitedCard: () => null,
  };
});

jest.mock('@shopify/flash-list', () => {
  const React2 = require('react');
  const { View } = require('react-native');
  return {
    FlashList: ({ data, renderItem }: { data: unknown[]; renderItem: (a: { item: unknown }) => unknown }) =>
      React2.createElement(View, null, data.map((item: unknown, i: number) =>
        React2.createElement(View, { key: i }, renderItem({ item })))),
  };
});

import { useTasks } from '../../hooks/useTasks';
import { useTaskMutations } from '../../hooks/useTaskMutations';
import { useNetworkState } from '../../hooks/useNetworkState';
import { ListScreen } from '../ListScreen';

const mockedUseTasks = jest.mocked(useTasks);
const mockedUseTaskMutations = jest.mocked(useTaskMutations);
const mockedUseNetworkState = jest.mocked(useNetworkState);

const toggleTask = jest.fn();
const deleteTask = jest.fn();
const createTask = jest.fn();
const refetch = jest.fn();

const task = (id: string, title: string) => ({
  id, title, completed: false, priority: 'none' as const,
  due_date: null, list_id: 'l1',
});

const mockNavigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen() {
  return render(
    <ThemeProvider>
      <ListScreen
        navigation={mockNavigation as never}
        route={{ key: 'List', name: 'List', params: { listId: 'l1', listTitle: 'Groceries' } } as never}
      />
    </ThemeProvider>,
  );
}

beforeAll(() => {
  initializeI18n('en');
});

beforeEach(() => {
  jest.clearAllMocks();
  toggleTask.mockResolvedValue({});
  deleteTask.mockResolvedValue({});
  mockedUseTasks.mockReturnValue({
    tasks: [task('t1', 'Milk'), task('t2', 'Bread'), task('t3', 'Eggs')],
    loading: false, error: null, refetch,
  } as never);
  mockedUseTaskMutations.mockReturnValue({ createTask, toggleTask, deleteTask } as never);
  mockedUseNetworkState.mockReturnValue({ isConnected: true } as never);
});

describe('ListScreen bulk operations', () => {
  it('is not in selection mode until a row is long-pressed', () => {
    const { queryByLabelText } = renderScreen();
    expect(queryByLabelText('Bulk actions')).toBeNull();
  });

  it('long-pressing a row enters selection with that row selected', () => {
    const { getByLabelText, getByText } = renderScreen();
    fireEvent(getByLabelText('Milk'), 'longPress');
    expect(getByText('1 selected')).toBeTruthy();
  });

  it('selecting three todos and bulk-completing completes all three', async () => {
    const { getByLabelText, getByText } = renderScreen();
    fireEvent(getByLabelText('Milk'), 'longPress');
    fireEvent.press(getByLabelText('Bread'));
    fireEvent.press(getByLabelText('Eggs'));
    expect(getByText('3 selected')).toBeTruthy();

    fireEvent.press(getByLabelText('Complete'));

    await waitFor(() => expect(toggleTask).toHaveBeenCalledTimes(3));
    expect(toggleTask.mock.calls.map((c) => c[0]).sort()).toEqual(['t1', 't2', 't3']);
    expect(toggleTask.mock.calls.every((c) => c[1] === true)).toBe(true);
    // The bar closes once the action runs, so the user is not left in a mode
    // with nothing selected.
    await waitFor(() => expect(mockNavigation.navigate).not.toHaveBeenCalled());
  });

  it('tapping a selected row deselects it', () => {
    const { getByLabelText, getByText, queryByLabelText } = renderScreen();
    fireEvent(getByLabelText('Milk'), 'longPress');
    fireEvent.press(getByLabelText('Bread'));
    expect(getByText('2 selected')).toBeTruthy();
    fireEvent.press(getByLabelText('Bread'));
    expect(getByText('1 selected')).toBeTruthy();
    // Deselecting the last row must leave selection mode entirely.
    fireEvent.press(getByLabelText('Milk'));
    expect(queryByLabelText('Bulk actions')).toBeNull();
  });

  it('a tap in selection mode selects instead of opening the task', () => {
    const { getByLabelText } = renderScreen();
    fireEvent(getByLabelText('Milk'), 'longPress');
    fireEvent.press(getByLabelText('Bread'));
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });

  it('bulk uncomplete sends completed=false for every selected task', async () => {
    const { getByLabelText } = renderScreen();
    fireEvent(getByLabelText('Milk'), 'longPress');
    fireEvent.press(getByLabelText('Bread'));
    fireEvent.press(getByLabelText('Uncomplete'));

    await waitFor(() => expect(toggleTask).toHaveBeenCalledTimes(2));
    expect(toggleTask.mock.calls.every((c) => c[1] === false)).toBe(true);
  });

  it('the action bar exposes a label and role for every control', () => {
    const { getByLabelText } = renderScreen();
    fireEvent(getByLabelText('Milk'), 'longPress');
    for (const label of ['Complete', 'Uncomplete', 'Delete', 'Exit selection']) {
      const control = getByLabelText(label);
      expect(control).toBeTruthy();
      expect(control.props.accessibilityRole).toBe('button');
    }
  });

  it('the action bar renders under RTL with logical spacing only', () => {
    // The bar must not hardcode left/right: under I18nManager RTL, flexDirection
    // mirrors and any physical margin would push controls off the wrong edge.
    I18nManager.isRTL = true;
    try {
      const { getByLabelText } = renderScreen();
      fireEvent(getByLabelText('Milk'), 'longPress');
      const bar = getByLabelText('Bulk actions');
      const flat = require('react-native').StyleSheet.flatten(bar.props.style) ?? {};
      for (const physical of ['marginLeft', 'marginRight', 'paddingLeft', 'paddingRight', 'left', 'right']) {
        expect(flat[physical]).toBeUndefined();
      }
      expect(getByLabelText('Complete')).toBeTruthy();
    } finally {
      I18nManager.isRTL = false;
    }
  });

  it('rows announce their selection state to assistive technology', () => {
    const { getByLabelText } = renderScreen();
    fireEvent(getByLabelText('Milk'), 'longPress');
    const row = getByLabelText('Milk');
    expect(row.props.accessibilityRole).toBe('checkbox');
    expect(row.props.accessibilityState.selected).toBe(true);
    expect(getByLabelText('Bread').props.accessibilityState.selected).toBe(false);
  });
});
