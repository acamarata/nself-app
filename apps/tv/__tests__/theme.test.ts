/**
 * Purpose: Unit tests for ɳTask TV theme tokens — enforce 10-foot UI minimums.
 * SPORT: Epic F — TV scaffold.
 */

import { typeScale, focusRing, darkColors } from '../src/theme';

describe('TV theme — 10-foot minimums', () => {
  test('all type scale values are ≥ 28px (hint minimum)', () => {
    for (const [name, size] of Object.entries(typeScale)) {
      expect(size).toBeGreaterThanOrEqual(28);
    }
  });

  test('body text is ≥ 40px', () => {
    expect(typeScale.body).toBeGreaterThanOrEqual(40);
  });

  test('heading3 (task row title) is ≥ 48px', () => {
    expect(typeScale.heading3).toBeGreaterThanOrEqual(48);
  });

  test('focus ring border width is ≥ 4px', () => {
    expect(focusRing.borderWidth).toBeGreaterThanOrEqual(4);
  });

  test('dark background is truly dark (hex starts with #0 or #1)', () => {
    expect(darkColors.background.toLowerCase()).toMatch(/^#0/);
  });

  test('brand color is defined and non-empty', () => {
    expect(darkColors.brand).toBeTruthy();
    expect(darkColors.brand).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});
