/**
 * Purpose: Root app entry for ɳTask TV — initializes i18n then mounts TVNavigator.
 * Inputs: none
 * Outputs: NselfI18nProvider → SafeAreaProvider → TVNavigator
 *          (FocusProvider → NavigationContainer → Connect|Dashboard|ListView|TaskDetail)
 * Constraints:
 *   - initializeI18n() must be called synchronously before any render to guarantee t()
 *     is available on the first frame. Called at module scope (top of file), not in useEffect.
 *   - NselfI18nProvider from @nself/i18n acts as the React context shell; the TV app
 *     uses its own i18next namespace setup (common + screens) via src/i18n/index.ts.
 *   - SafeAreaProvider handles overscan on tvOS (Apple TV has no notch but safe area
 *     insets account for the TV overscan zone on older displays).
 *   - expo-status-bar hidden on TV (status bar doesn't exist on TV OS).
 * SPORT: Epic F — TV scaffold / F-S2-T6 (i18n TV wave).
 */

import React from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { NselfI18nProvider } from '@nself/i18n'
import { TVNavigator } from './navigation/TVNavigator'
import { initializeI18n, getDeviceLocale } from './i18n'

// Initialize i18next at module load — before any component renders.
initializeI18n()

export default function App() {
  const locale = getDeviceLocale()

  return (
    <NselfI18nProvider locale={locale}>
      <SafeAreaProvider>
        <TVNavigator />
      </SafeAreaProvider>
    </NselfI18nProvider>
  )
}
