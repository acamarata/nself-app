import React from 'react';
import { render } from '@testing-library/react-native';
import { SettingsScreen } from '../app/SettingsScreen';

jest.mock('../hooks/useSettings', () => ({
  useSettings: () => ({
    serverUrl: 'https://example.com',
    setServerUrl: jest.fn(),
    language: 'en',
    setLanguage: jest.fn(),
    appearance: 'system',
    setAppearance: jest.fn(),
  }),
}));

jest.mock('../hooks/useNotificationPrefs', () => ({
  useNotificationPrefs: () => ({
    prefs: { masterEnabled: true, comments: true, assigned: true, reminders: true },
    setMasterEnabled: jest.fn(),
    setComments: jest.fn(),
    setAssigned: jest.fn(),
    setReminders: jest.fn(),
  }),
}));

const mockNavigation = { goBack: jest.fn(), navigate: jest.fn() };

describe('SettingsScreen', () => {
  it('renders server URL input', () => {
    const { getByDisplayValue } = render(
      <SettingsScreen navigation={mockNavigation as any} route={{} as any} />,
    );
    expect(getByDisplayValue('https://example.com')).toBeTruthy();
  });

  it('renders language options', () => {
    const { getByLabelText } = render(
      <SettingsScreen navigation={mockNavigation as any} route={{} as any} />,
    );
    expect(getByLabelText('English')).toBeTruthy();
    expect(getByLabelText('العربية')).toBeTruthy();
    expect(getByLabelText('Français')).toBeTruthy();
    expect(getByLabelText('Español')).toBeTruthy();
  });

  it('renders appearance options', () => {
    const { getByLabelText } = render(
      <SettingsScreen navigation={mockNavigation as any} route={{} as any} />,
    );
    expect(getByLabelText('System')).toBeTruthy();
    expect(getByLabelText('Light')).toBeTruthy();
    expect(getByLabelText('Dark')).toBeTruthy();
  });
});
