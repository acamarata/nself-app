/**
 * Purpose: ErrorCard theme-aware render tests
 * SPORT: P5-mobile-robustness
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../../../theme';
import { ErrorCard } from '../ErrorCard';

const wrap = (ui: React.ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>);

describe('ErrorCard', () => {
  it('renders default message', () => {
    const { getByText } = wrap(<ErrorCard />);
    expect(getByText('Something went wrong')).toBeTruthy();
  });

  it('renders custom message', () => {
    const { getByText } = wrap(<ErrorCard message="Network error" />);
    expect(getByText('Network error')).toBeTruthy();
  });

  it('calls onRetry when retry pressed', () => {
    const onRetry = jest.fn();
    const { getByText } = wrap(<ErrorCard onRetry={onRetry} />);
    fireEvent.press(getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('has accessibilityRole alert', () => {
    const { UNSAFE_getByProps } = wrap(<ErrorCard />);
    // RNTL v12 does not support accessibilityRole="alert" via getByRole — use UNSAFE_getByProps
    expect(UNSAFE_getByProps({ accessibilityRole: 'alert' })).toBeTruthy();
  });
});
