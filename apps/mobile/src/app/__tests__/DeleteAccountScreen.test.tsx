/**
 * Purpose: Unit tests for DeleteAccountScreen — warning copy, confirmation gate, loading state.
 * Constraints: useAccount and navigation are mocked; no real urql calls.
 * SPORT: P5-J-delete-account-screen
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';

const mockDeleteAccount = jest.fn();

jest.mock('../../hooks/useAccount', () => ({
  useAccountMutations: () => ({
    deleteAccount: mockDeleteAccount,
  }),
}));

// Provide a minimal navigation mock matching the props the screen uses
const mockNavigation = {
  goBack: jest.fn(),
  reset: jest.fn(),
};

import { DeleteAccountScreen } from '../DeleteAccountScreen';

function renderScreen() {
  return render(
    <ThemeProvider>
      <DeleteAccountScreen
        navigation={mockNavigation as never}
        route={{ key: 'DeleteAccount', name: 'DeleteAccount' } as never}
      />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('DeleteAccountScreen', () => {
  describe('warning copy', () => {
    it('renders the "This cannot be undone" warning title', () => {
      const { getByText } = renderScreen();
      expect(getByText('This cannot be undone')).toBeTruthy();
    });

    it('renders the irreversibility body text', () => {
      const { getByText } = renderScreen();
      expect(
        getByText(/permanently remove all your lists, tasks/i),
      ).toBeTruthy();
    });
  });

  describe('confirmation gate', () => {
    it('delete button is disabled initially (before any input)', () => {
      const { getByLabelText } = renderScreen();
      const btn = getByLabelText('Delete my account');
      expect(btn.props.accessibilityState?.disabled).toBe(true);
    });

    it('delete button stays disabled on partial text "DEL"', () => {
      const { getByLabelText, getByLabelText: getLbl } = renderScreen();
      const input = getLbl('Type DELETE to confirm');
      fireEvent.changeText(input, 'DEL');
      const btn = getByLabelText('Delete my account');
      expect(btn.props.accessibilityState?.disabled).toBe(true);
    });

    it('delete button becomes enabled when user types exactly "DELETE"', () => {
      const { getByLabelText } = renderScreen();
      const input = getByLabelText('Type DELETE to confirm');
      fireEvent.changeText(input, 'DELETE');
      const btn = getByLabelText('Delete my account');
      expect(btn.props.accessibilityState?.disabled).toBe(false);
    });

    it('delete button is disabled again when text is cleared after "DELETE"', () => {
      const { getByLabelText } = renderScreen();
      const input = getByLabelText('Type DELETE to confirm');
      fireEvent.changeText(input, 'DELETE');
      fireEvent.changeText(input, '');
      const btn = getByLabelText('Delete my account');
      expect(btn.props.accessibilityState?.disabled).toBe(true);
    });
  });

  describe('navigation', () => {
    it('Back button calls navigation.goBack()', () => {
      const { getByLabelText } = renderScreen();
      fireEvent.press(getByLabelText('Back'));
      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    });

    it('Cancel button calls navigation.goBack()', () => {
      const { getByLabelText } = renderScreen();
      fireEvent.press(getByLabelText('Cancel'));
      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    });
  });
});
