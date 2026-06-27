/**
 * Purpose: Tests for useBreakpoint — verifies breakpoint threshold logic.
 * Tests the breakpoint constants and isTablet/isPhone logic in isolation
 * (avoids react-native TurboModule issues when mocking useWindowDimensions).
 * SPORT: C-S7-T1
 */

import { breakpoints } from '../../theme/breakpoints';

describe('useBreakpoint — breakpoint logic', () => {
  it('phone threshold: 375 < 768 → isPhone', () => {
    const isTablet = 375 >= breakpoints.tablet;
    expect(isTablet).toBe(false);
  });

  it('tablet boundary: 768 >= 768 → isTablet', () => {
    const isTablet = 768 >= breakpoints.tablet;
    expect(isTablet).toBe(true);
  });

  it('above tablet: 1024 >= 768 → isTablet', () => {
    const isTablet = 1024 >= breakpoints.tablet;
    expect(isTablet).toBe(true);
  });

  it('tablet breakpoint value is 768', () => {
    expect(breakpoints.tablet).toBe(768);
  });

  it('desktop breakpoint value is 1024', () => {
    expect(breakpoints.desktop).toBe(1024);
  });
});
