/**
 * Purpose: Root app entry for ɳTask TV — mounts TVNavigator inside SafeAreaProvider.
 * Inputs: none
 * Outputs: TVNavigator (FocusProvider → NavigationContainer → Connect|Dashboard|ListView|TaskDetail)
 * Constraints:
 *   - No i18n provider: TV is English-only in v1 (keyboard entry for server URL/credentials
 *     requires only ASCII; content is fetched from the user's own server which handles locale).
 *   - No Sentry wrap in v1 — add in a follow-up ticket once EAS tvOS profile is provisioned.
 *   - SafeAreaProvider handles notch/overscan on tvOS (Apple TV has no notch but the
 *     safe area insets account for the TV overscan zone on older displays).
 *   - expo-status-bar hidden on TV (status bar doesn't exist on TV OS).
 * SPORT: Epic F — TV scaffold.
 */

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TVNavigator } from './navigation/TVNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <TVNavigator />
    </SafeAreaProvider>
  );
}
