/**
 * Purpose: Tests for ProfileScreen — profile header and version display.
 * SPORT: C-S3-T2
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../theme';

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    accessToken: 'eyJ.eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.sig',
    signOut: jest.fn(),
  }),
}));

jest.mock('../hooks/useSettings', () => ({
  useSettings: () => ({ serverUrl: 'https://example.com' }),
}));

// expo-constants: use __esModule: true to match named default export
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.1.4' } },
}));

import { ProfileScreen } from '../app/ProfileScreen';

const mockNavigation = { goBack: jest.fn() };

describe('ProfileScreen', () => {
  it('renders profile header', () => {
    const { getByText } = render(
      <ThemeProvider>
        <ProfileScreen navigation={mockNavigation as any} route={{} as any} />
      </ThemeProvider>,
    );
    expect(getByText('Profile')).toBeTruthy();
  });

  it('shows version from expo-constants', () => {
    const { getByText } = render(
      <ThemeProvider>
        <ProfileScreen navigation={mockNavigation as any} route={{} as any} />
      </ThemeProvider>,
    );
    expect(getByText('v1.1.4')).toBeTruthy();
  });
});
