/**
 * Purpose: Unit tests for CalendarScreen — i18n'd header, week navigation, and the
 *          MB-4 acceptance test: a task due this week appears in its day section
 *          with its list colour; plus row tap navigation and 7-state handling.
 * Inputs: mocked useSmartViews (task buckets); mocked urql useQuery (GET_LISTS).
 * Outputs: jest assertions on day-section membership, colour-bar style, and navigation.
 * Constraints: Runs under jest-expo; seven-states stubbed; initializeI18n('en') is
 *          real so t() resolves against src/i18n/en/*.json namespaces.
 * SPORT: MB-4 calendar view on mobile
 */

import React from 'react';
import { I18nManager, StyleSheet } from 'react-native';
import { fireEvent, render, within } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { initializeI18n } from '../../i18n';

jest.mock('urql', () => ({
  useQuery: jest.fn(),
  gql: (s: TemplateStringsArray) => s[0],
}));

jest.mock('../../hooks/useSmartViews', () => ({
  useSmartViews: jest.fn(),
}));

jest.mock('../../components/seven-states', () => {
  const { Text, View } = require('react-native');
  return {
    ErrorCard: ({ message }: { message: string }) => <Text>{message}</Text>,
    SkeletonList: () => <View testID="skeleton-list" />,
  };
});

import { useQuery } from 'urql';
import { useSmartViews } from '../../hooks/useSmartViews';
import { CalendarScreen } from '../CalendarScreen';
import { addDays, isoDayOf, startOfWeek } from '../../hooks/useWeekTasks';
import type { SmartViewTask } from '../../lib/smartViewsOps';

const mockedUseQuery = jest.mocked(useQuery);
const mockedUseSmartViews = jest.mocked(useSmartViews);

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

function renderScreen() {
  return render(
    <ThemeProvider>
      <CalendarScreen
        navigation={mockNavigation as never}
        route={{ key: 'Calendar', name: 'Calendar' } as never}
      />
    </ThemeProvider>,
  );
}

/** ISO due date at a local-time hour on the given day. */
function dueAt(date: Date, hour = 9): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0, 0);
  return d.toISOString();
}

function makeTask(id: string, title: string, due: Date, listId: string): SmartViewTask {
  return { id, title, completed: false, priority: 'none', due_date: dueAt(due), list_id: listId };
}

/** Monday of the current week — always inside the visible week at any run time. */
function thisMonday(): Date {
  return addDays(startOfWeek(new Date()), 1);
}

/** Friday of the current week — always inside the visible week at any run time. */
function thisFriday(): Date {
  return addDays(startOfWeek(new Date()), 5);
}

beforeAll(() => {
  initializeI18n('en');
});

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseSmartViews.mockReturnValue({
    today: [], upcoming: [], overdue: [], loading: false, error: null, refetch: jest.fn(),
  });
  mockedUseQuery.mockReturnValue([
    { data: { np_lists: [{ id: 'l1', title: 'Work', color: '#ef4444' }] }, fetching: false, error: undefined },
    jest.fn(),
  ] as never);
});

afterEach(() => {
  I18nManager.isRTL = false;
});

describe('CalendarScreen', () => {
  it('renders the i18n header title and week navigation', () => {
    const { getByText, getByLabelText } = renderScreen();
    expect(getByText('Calendar')).toBeTruthy();
    expect(getByLabelText('Previous week')).toBeTruthy();
    expect(getByLabelText('Next week')).toBeTruthy();
    expect(getByLabelText('Today')).toBeTruthy();
  });

  it('shows a task due this week on the right day with its list colour (MB-4 acceptance)', () => {
    const now = new Date();
    const dueToday = makeTask('t1', 'Ship release', now, 'l1');
    mockedUseSmartViews.mockReturnValue({
      today: [dueToday], upcoming: [], overdue: [], loading: false, error: null, refetch: jest.fn(),
    });

    const { getByTestId } = renderScreen();
    const daySection = getByTestId(`calendar-day-${isoDayOf(now)}`);
    expect(within(daySection).getByText('Ship release')).toBeTruthy();

    const colourBar = within(daySection).getByTestId('task-color-t1');
    expect(StyleSheet.flatten(colourBar.props.style).backgroundColor).toBe('#ef4444');
  });

  it('places each task in its own due day section', () => {
    const monday = thisMonday();
    const friday = thisFriday();
    mockedUseSmartViews.mockReturnValue({
      today: [],
      upcoming: [
        makeTask('m1', 'Monday task', monday, 'l1'),
        makeTask('f1', 'Friday task', friday, 'l1'),
      ],
      overdue: [], loading: false, error: null, refetch: jest.fn(),
    });

    const { getByTestId } = renderScreen();
    const mondaySection = getByTestId(`calendar-day-${isoDayOf(monday)}`);
    const fridaySection = getByTestId(`calendar-day-${isoDayOf(friday)}`);

    expect(within(mondaySection).getByText('Monday task')).toBeTruthy();
    expect(within(mondaySection).queryByText('Friday task')).toBeNull();
    expect(within(fridaySection).getByText('Friday task')).toBeTruthy();
    // Sunday carries no tasks in this fixture, whatever day the test runs on.
    const sunday = startOfWeek(new Date());
    expect(within(getByTestId(`calendar-day-${isoDayOf(sunday)}`)).getByText('Nothing due')).toBeTruthy();
  });

  it('navigates to the next week and back to the current week via Today', () => {
    const now = new Date();
    const { getByLabelText, getByTestId, queryByTestId } = renderScreen();
    expect(getByTestId(`calendar-day-${isoDayOf(now)}`)).toBeTruthy();
    expect(getByLabelText('Today').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(getByLabelText('Next week'));
    expect(queryByTestId(`calendar-day-${isoDayOf(now)}`)).toBeNull();
    expect(getByLabelText('Today').props.accessibilityState.disabled).toBe(false);

    fireEvent.press(getByLabelText('Today'));
    expect(getByTestId(`calendar-day-${isoDayOf(now)}`)).toBeTruthy();
  });

  it('shows the previous week on Previous week', () => {
    const lastMonday = addDays(thisMonday(), -7);
    const { getByLabelText, getByTestId } = renderScreen();
    fireEvent.press(getByLabelText('Previous week'));
    expect(getByTestId(`calendar-day-${isoDayOf(lastMonday)}`)).toBeTruthy();
  });

  it('navigates to TaskDetail when a task row is tapped', () => {
    mockedUseSmartViews.mockReturnValue({
      today: [makeTask('t1', 'Ship release', new Date(), 'l1')],
      upcoming: [], overdue: [], loading: false, error: null, refetch: jest.fn(),
    });

    const { getByLabelText } = renderScreen();
    fireEvent.press(getByLabelText('Ship release, Work'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('TaskDetail', { taskId: 't1', listId: 'l1' });
  });

  it('shows SkeletonList while loading with no tasks', () => {
    mockedUseSmartViews.mockReturnValue({
      today: [], upcoming: [], overdue: [], loading: true, error: null, refetch: jest.fn(),
    });
    const { getByTestId } = renderScreen();
    expect(getByTestId('skeleton-list')).toBeTruthy();
  });

  it('shows ErrorCard with the error message', () => {
    mockedUseSmartViews.mockReturnValue({
      today: [], upcoming: [], overdue: [], loading: false, error: 'Network error', refetch: jest.fn(),
    });
    const { getByText } = renderScreen();
    expect(getByText('Network error')).toBeTruthy();
  });

  it('renders day sections with tasks under RTL layout', () => {
    I18nManager.isRTL = true;
    const now = new Date();
    mockedUseSmartViews.mockReturnValue({
      today: [makeTask('t1', 'Ship release', now, 'l1')],
      upcoming: [], overdue: [], loading: false, error: null, refetch: jest.fn(),
    });

    const { getByTestId } = renderScreen();
    const daySection = getByTestId(`calendar-day-${isoDayOf(now)}`);
    expect(within(daySection).getByText('Ship release')).toBeTruthy();
  });

  it('goes back when the back button is tapped', () => {
    const { getByLabelText } = renderScreen();
    fireEvent.press(getByLabelText('Back'));
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });
});
