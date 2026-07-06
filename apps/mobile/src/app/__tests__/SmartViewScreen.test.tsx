/**
 * Purpose: Unit tests for SmartViewScreen — header, filter chips, 7-state body per bucket.
 * Inputs: mocked useSmartViews hook.
 * Outputs: jest assertions on rendered structure, chip switching, and navigation on row tap.
 * Constraints: Runs under jest-expo preset; seven-states components stubbed to avoid native deps.
 * SPORT: mobile/web parity delta — Smart Views (Today/Overdue) small mobile addition
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';

jest.mock('../../hooks/useSmartViews', () => ({
  useSmartViews: jest.fn(),
}));

jest.mock('../../components/seven-states', () => {
  const { Text, View } = require('react-native');
  return {
    EmptyState: ({ title }: { title: string }) => <Text>{title}</Text>,
    ErrorCard: ({ message }: { message: string }) => <Text>{message}</Text>,
    SkeletonList: () => <View testID="skeleton-list" />,
  };
});

import { useSmartViews } from '../../hooks/useSmartViews';
import { SmartViewScreen } from '../SmartViewScreen';

const mockedUseSmartViews = jest.mocked(useSmartViews);

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

function renderScreen() {
  return render(
    <ThemeProvider>
      <SmartViewScreen
        navigation={mockNavigation as never}
        route={{ key: 'SmartView', name: 'SmartView' } as never}
      />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseSmartViews.mockReturnValue({
    today: [],
    overdue: [],
    upcoming: [],
    loading: false,
    error: null,
    refetch: jest.fn(),
  });
});

describe('SmartViewScreen', () => {
  it('renders the header title', () => {
    const { getByText } = renderScreen();
    expect(getByText('Smart Views')).toBeTruthy();
  });

  it('renders all three filter chips with counts', () => {
    mockedUseSmartViews.mockReturnValue({
      today: [{ id: '1', title: 'A', completed: false, priority: 'none', due_date: null, list_id: 'l1' }],
      overdue: [],
      upcoming: [
        { id: '2', title: 'B', completed: false, priority: 'none', due_date: null, list_id: 'l1' },
        { id: '3', title: 'C', completed: false, priority: 'none', due_date: null, list_id: 'l1' },
      ],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    const { getByText } = renderScreen();
    expect(getByText('Today (1)')).toBeTruthy();
    expect(getByText('Overdue (0)')).toBeTruthy();
    expect(getByText('Upcoming (2)')).toBeTruthy();
  });

  it('defaults to the Today bucket and shows its empty state', () => {
    const { getByText } = renderScreen();
    expect(getByText('Nothing due today')).toBeTruthy();
  });

  it('switches to Overdue bucket empty state on chip tap', () => {
    const { getByText, getByLabelText } = renderScreen();
    fireEvent.press(getByLabelText('Overdue filter'));
    expect(getByText('Nothing overdue')).toBeTruthy();
  });

  it('shows SkeletonList while loading with no tasks', () => {
    mockedUseSmartViews.mockReturnValue({
      today: [], overdue: [], upcoming: [], loading: true, error: null, refetch: jest.fn(),
    });
    const { getByTestId } = renderScreen();
    expect(getByTestId('skeleton-list')).toBeTruthy();
  });

  it('shows ErrorCard with the error message', () => {
    mockedUseSmartViews.mockReturnValue({
      today: [], overdue: [], upcoming: [], loading: false, error: 'Network error', refetch: jest.fn(),
    });
    const { getByText } = renderScreen();
    expect(getByText('Network error')).toBeTruthy();
  });

  it('navigates to TaskDetail when a task row is tapped', () => {
    mockedUseSmartViews.mockReturnValue({
      today: [{ id: 't1', title: 'Buy milk', completed: false, priority: 'none', due_date: '2026-07-06T09:00:00.000Z', list_id: 'l1' }],
      overdue: [],
      upcoming: [],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    const { getByLabelText } = renderScreen();
    fireEvent.press(getByLabelText('Buy milk'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('TaskDetail', { taskId: 't1', listId: 'l1' });
  });

  it('navigates back when the back button is tapped', () => {
    const { getByLabelText } = renderScreen();
    fireEvent.press(getByLabelText('Back'));
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });
});
