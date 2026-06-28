/**
 * Purpose: Unit tests for LoginScreen — form rendering, ToS gate, error display, loading state.
 * Inputs: mocked useAuth hook; navigation mock.
 * Outputs: jest assertions on rendered UI and callback behaviour.
 * Constraints: Runs under jest-expo preset; no real auth calls.
 * SPORT: P5-C-login-screen
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';

const mockAuthBase = () => ({
  signIn: jest.fn(),
  signOut: jest.fn(),
  loading: false as boolean,
  error: null as string | null,
  serverUrl: null as string | null,
  accessToken: null as string | null,
});

jest.mock('../../hooks/useAuth', () => ({
  useAuth: jest.fn(() => mockAuthBase()),
}));

import { useAuth } from '../../hooks/useAuth';
import { LoginScreen } from '../LoginScreen';

const mockNavigation = { replace: jest.fn(), navigate: jest.fn(), goBack: jest.fn() };

function renderScreen() {
  return render(
    <ThemeProvider>
      <LoginScreen
        navigation={mockNavigation as never}
        route={{ key: 'Login', name: 'Login' } as never}
      />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue(mockAuthBase());
});

describe('LoginScreen', () => {
  describe('rendering', () => {
    it('renders the ɳTask logo text', () => {
      const { getByText } = renderScreen();
      expect(getByText('ɳTask')).toBeTruthy();
    });

    it('renders the subtitle text', () => {
      const { getByText } = renderScreen();
      expect(getByText('Self-hosted task management')).toBeTruthy();
    });

    it('renders the Server URL input', () => {
      const { getByLabelText } = renderScreen();
      expect(getByLabelText('Server URL')).toBeTruthy();
    });

    it('renders the Email input', () => {
      const { getByLabelText } = renderScreen();
      expect(getByLabelText('Email')).toBeTruthy();
    });

    it('renders the Password input', () => {
      const { getByLabelText } = renderScreen();
      expect(getByLabelText('Password')).toBeTruthy();
    });

    it('renders the Terms of Service link text', () => {
      const { getByText } = renderScreen();
      expect(getByText('Terms of Service')).toBeTruthy();
    });
  });

  describe('ToS gate', () => {
    it('Sign in button is disabled by default (ToS not accepted)', () => {
      const { getByLabelText } = renderScreen();
      const btn = getByLabelText('Sign in');
      expect(btn.props.accessibilityState?.disabled ?? btn.props.disabled).toBeTruthy();
    });

    it('pressing the ToS checkbox enables the Sign in button', () => {
      const { getByLabelText } = renderScreen();
      const checkbox = getByLabelText('Accept Terms of Service');
      fireEvent.press(checkbox);
      const btn = getByLabelText('Sign in');
      expect(btn.props.accessibilityState?.disabled ?? btn.props.disabled).toBeFalsy();
    });

    it('pressing the ToS checkbox twice disables the button again', () => {
      const { getByLabelText } = renderScreen();
      const checkbox = getByLabelText('Accept Terms of Service');
      fireEvent.press(checkbox);
      fireEvent.press(checkbox);
      const btn = getByLabelText('Sign in');
      expect(btn.props.accessibilityState?.disabled ?? btn.props.disabled).toBeTruthy();
    });
  });

  describe('error display', () => {
    it('shows error message from useAuth when error is set', () => {
      jest.mocked(useAuth).mockReturnValue({ ...mockAuthBase(), error: 'Invalid credentials' });
      const { getByText } = renderScreen();
      expect(getByText('Invalid credentials')).toBeTruthy();
    });

    it('does not render an error element when error is null', () => {
      const { queryByText } = renderScreen();
      // null error means no error text; just verify no stray error message appears
      expect(queryByText('Invalid credentials')).toBeNull();
    });
  });

  describe('loading state', () => {
    it('shows ActivityIndicator when loading=true', () => {
      jest.mocked(useAuth).mockReturnValue({ ...mockAuthBase(), loading: true });
      const { UNSAFE_getByType } = renderScreen();
      // Accept ActivityIndicator presence — button also becomes disabled
      const { ActivityIndicator } = require('react-native');
      expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    });

    it('Sign in button is disabled when loading=true even if ToS accepted', () => {
      jest.mocked(useAuth).mockReturnValue({ ...mockAuthBase(), loading: true });
      const { getByLabelText } = renderScreen();
      // Accept the ToS first
      const checkbox = getByLabelText('Accept Terms of Service');
      fireEvent.press(checkbox);
      const btn = getByLabelText('Sign in');
      expect(btn.props.accessibilityState?.disabled ?? btn.props.disabled).toBeTruthy();
    });
  });
});
