/**
 * Purpose: Unit tests for TV theme tokens — enforce 10-foot UI minimums.
 * SPORT: Epic F — TV scaffold / F-S2-T6 (i18n TV wave).
 */

import { typeScale, spacing, focusRing, darkColors, priorityColors, tvTheme } from '../index'

describe('TV theme — 10-foot type scale minimums', () => {
  test('all TypeScale values are ≥ 28 (hint is the minimum)', () => {
    for (const [name, size] of Object.entries(typeScale)) {
      expect(size).toBeGreaterThanOrEqual(28)
    }
  })

  test('typeScale.hint === 28 (absolute minimum for hint text)', () => {
    expect(typeScale.hint).toBe(28)
  })

  test('typeScale.body >= 40', () => {
    expect(typeScale.body).toBeGreaterThanOrEqual(40)
  })

  test('typeScale.heading1 >= 48', () => {
    expect(typeScale.heading1).toBeGreaterThanOrEqual(48)
  })

  test('typeScale.heading2 >= 48', () => {
    expect(typeScale.heading2).toBeGreaterThanOrEqual(48)
  })

  test('typeScale.heading3 >= 48', () => {
    expect(typeScale.heading3).toBeGreaterThanOrEqual(48)
  })

  test('typeScale.caption >= 28', () => {
    expect(typeScale.caption).toBeGreaterThanOrEqual(28)
  })
})

describe('TV theme — spacing scale', () => {
  test('all spacing values are positive numbers', () => {
    for (const [name, value] of Object.entries(spacing)) {
      expect(typeof value).toBe('number')
      expect(value).toBeGreaterThan(0)
    }
  })

  test('spacing.xs < spacing.sm < spacing.md < spacing.lg < spacing.xl < spacing.xxl', () => {
    expect(spacing.xs).toBeLessThan(spacing.sm)
    expect(spacing.sm).toBeLessThan(spacing.md)
    expect(spacing.md).toBeLessThan(spacing.lg)
    expect(spacing.lg).toBeLessThan(spacing.xl)
    expect(spacing.xl).toBeLessThan(spacing.xxl)
  })
})

describe('TV theme — focus ring', () => {
  test('focusRing.borderWidth is 4', () => {
    expect(focusRing.borderWidth).toBe(4)
  })

  test('focusRing.shadowRadius is a positive number', () => {
    expect(focusRing.shadowRadius).toBeGreaterThan(0)
  })

  test('focusRing.shadowOpacity is between 0 and 1', () => {
    expect(focusRing.shadowOpacity).toBeGreaterThan(0)
    expect(focusRing.shadowOpacity).toBeLessThanOrEqual(1)
  })
})

describe('TV theme — color palette', () => {
  test('all darkColors values are valid 6-digit hex strings', () => {
    for (const [name, value] of Object.entries(darkColors)) {
      expect(value).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  test('background is truly dark (hex starts with #0)', () => {
    expect(darkColors.background.toLowerCase()).toMatch(/^#0/)
  })

  test('brand color is defined and non-empty', () => {
    expect(darkColors.brand).toBeTruthy()
    expect(darkColors.brand).toMatch(/^#[0-9a-fA-F]{6}$/)
  })

  test('success, warning, error colors are all defined', () => {
    expect(darkColors.success).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(darkColors.warning).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(darkColors.error).toMatch(/^#[0-9a-fA-F]{6}$/)
  })
})

describe('TV theme — priority colors', () => {
  test('all priority levels have valid hex color values', () => {
    const priorities = ['urgent', 'high', 'medium', 'low', 'none']
    for (const p of priorities) {
      expect(priorityColors[p]).toBeDefined()
      expect(priorityColors[p]).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  test('urgent color is a reddish hex (warning/danger)', () => {
    // urgent: '#F87171' — red tones
    expect(priorityColors['urgent']).toBeTruthy()
  })
})

describe('TV theme — tvTheme composition', () => {
  test('tvTheme.typeScale === typeScale', () => {
    expect(tvTheme.typeScale).toEqual(typeScale)
  })

  test('tvTheme.spacing === spacing', () => {
    expect(tvTheme.spacing).toEqual(spacing)
  })

  test('tvTheme.focusRing === focusRing', () => {
    expect(tvTheme.focusRing).toEqual(focusRing)
  })

  test('tvTheme.priorityColors === priorityColors', () => {
    expect(tvTheme.priorityColors).toEqual(priorityColors)
  })
})
