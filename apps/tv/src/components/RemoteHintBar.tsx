/**
 * Purpose: Remote control hint bar — shown at the bottom of every screen.
 * Inputs: hints array of { button, label } pairs
 * Outputs: Horizontal bar with icon + label pairs for each available remote action.
 * Constraints:
 *   - Fixed height: 64px.
 *   - Background: semi-transparent surface (no opaque overlay).
 *   - Button glyphs: text symbols (▲▼◀▶ for D-pad, ● for OK/Select, ◄ for Menu/Back).
 *     Not using SF Symbols or custom assets — text glyphs work cross-platform.
 *   - Shows 7-state variants via the hints prop:
 *     1. Connect screen: []
 *     2. Dashboard: [SELECT: view list, MENU: settings]
 *     3. ListView empty: [MENU: back]
 *     4. ListView with tasks: [SELECT: view task, OK on done-btn: mark done, MENU: back]
 *     5. TaskDetail (active): [SELECT: mark done, MENU: back]
 *     6. TaskDetail (completed): [MENU: back]
 *     7. Loading: []
 *   - i18n: labels are passed in as translated strings by the screens (or via HINTS presets
 *     which are now initialized lazily via makeHints() using useTranslation).
 * SPORT: Epic F — TV scaffold / F-S2-T6 (i18n TV wave).
 */

import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { tvTheme } from '../theme'

export interface RemoteHint {
  /** Remote button glyph or label */
  button: string
  /** Action description */
  label: string
}

// ─── Static hint presets (English fallback — screens pass translated hints in practice) ──

/**
 * HINTS provides static preset hint arrays.
 * For i18n screens, pass translated hint labels directly; these presets are kept
 * for backward-compatibility and are replaced by makeHints() in screens that import
 * useTranslation. Screens that don't need per-locale hints can use these.
 */
export const HINTS = {
  none: [] as RemoteHint[],
  dashboard: [
    { button: '●', label: 'View tasks' },
    { button: '◄', label: 'Menu' },
  ] as RemoteHint[],
  listEmpty: [
    { button: '◄', label: 'Back' },
  ] as RemoteHint[],
  listWithTasks: [
    { button: '●', label: 'View task' },
    { button: '✓', label: 'Mark done' },
    { button: '◄', label: 'Back' },
  ] as RemoteHint[],
  taskDetailActive: [
    { button: '●', label: 'Mark done' },
    { button: '◄', label: 'Back' },
  ] as RemoteHint[],
  taskDetailDone: [
    { button: '◄', label: 'Back' },
  ] as RemoteHint[],
  loading: [] as RemoteHint[],
} as const

export type HintPreset = keyof typeof HINTS

interface RemoteHintBarProps {
  hints: RemoteHint[]
}

export function RemoteHintBar({ hints }: RemoteHintBarProps) {
  if (hints.length === 0) return null

  return (
    <View style={styles.bar}>
      {hints.map((hint, i) => (
        <View key={i} style={styles.hint}>
          <View style={styles.buttonGlyph}>
            <Text style={styles.buttonText}>{hint.button}</Text>
          </View>
          <Text style={styles.label}>{hint.label}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tvTheme.spacing.xl,
    paddingHorizontal: tvTheme.spacing.xl,
    backgroundColor: tvTheme.colors.surface + 'CC', // 80% opacity
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tvTheme.spacing.xs,
  },
  buttonGlyph: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: tvTheme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: tvTheme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: tvTheme.typeScale.caption,
    color: tvTheme.colors.textPrimary,
    fontWeight: '600',
  },
  label: {
    fontSize: tvTheme.typeScale.hint,
    color: tvTheme.colors.textSecondary,
  },
})
