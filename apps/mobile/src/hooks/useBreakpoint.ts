/**
 * Purpose: Responsive breakpoint detection for ɳTask mobile.
 * Returns { isTablet, isPhone } based on window width.
 * Used to render 2-column layouts on iPad (≥768pt).
 * Constraints: All useWindowDimensions calls MUST go through this hook.
 */
import { useWindowDimensions } from 'react-native';
import { breakpoints } from '../theme/breakpoints';

export interface BreakpointResult {
  isTablet: boolean;
  isPhone: boolean;
  width: number;
  height: number;
}

export function useBreakpoint(): BreakpointResult {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= breakpoints.tablet;
  return { isTablet, isPhone: !isTablet, width, height };
}
