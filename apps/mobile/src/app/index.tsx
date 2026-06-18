/**
 * Purpose: Root app entry — urql Provider, i18n, observability (Sentry + OTel),
 *          navigation stack, auth gate
 * Inputs: Auth state from useAuth hook (backed by @nself/auth-core); urql Client from @nself/graphql-client;
 *         EXPO_PUBLIC_SENTRY_DSN, EXPO_PUBLIC_OTEL_ENDPOINT, APP_ENV, EXPO_PUBLIC_APP_VERSION from build env.
 * Outputs: NavigationContainer with Login|Home|List|TaskDetail screens, Sentry + OTel registered.
 * Constraints: Shows Login if no access token; mirrors Flutter NTasksApp auth gate.
 *   @nself/ui is web-only (Radix/shadcn); native loading spinner stays RN ActivityIndicator.
 *   @nself/observability wired at module level with @sentry/react-native SDK injection.
 *   Sentry.wrap(App) used as default export for native crash capture (JS + native threads).
 *   PII scrubbing runs unconditionally via scrubEvent as beforeSend inside initObservability.
 *   @nself/i18n NselfI18nProvider wraps the tree; locale detected via expo-localization.
 *   RTL: initializeI18n() called at module level so I18nManager.forceRTL fires before first render.
 * SPORT: Port of app/lib/app.dart + main.dart root (SDK 53 upgrade; E2 @nself/* wiring)
 */

import React, { useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as UrqlProvider } from 'urql';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NselfI18nProvider } from '@nself/i18n';
import type { Locale } from '@nself/i18n';
import { getLocales } from 'expo-localization';
import * as SentryRN from '@sentry/react-native';
import type { SentrySdk } from '@nself/observability';
import { initObservability } from '@nself/observability';
import { useAuth } from '../hooks/useAuth';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { createUrqlClient } from '../lib/api';
import { LoginScreen } from './LoginScreen';
import { HomeScreen } from './HomeScreen';
import { ListScreen } from './ListScreen';
import { TaskDetailScreen } from './TaskDetailScreen';
import type { RootStackParamList } from '../types';
import { initializeI18n } from '../i18n';

// ─── RTL init (module level — before first render) ────────────────────────────
// initializeI18n detects locale via I18nManager constants and calls
// I18nManager.forceRTL(true) for Arabic/RTL locales. The expo-localization
// language code is used as an override so UI locale and layout stay in sync.
const _deviceLocales = getLocales();
const _deviceLang = _deviceLocales[0]?.languageCode ?? 'en';
initializeI18n(_deviceLang);

// ─── Sentry + OTel init (module level — before first render) ─────────────────
// initObservability calls Sentry.init() with scrubEvent as beforeSend (strips user.email,
// user.id) and registers OTel tracing. Gracefully no-ops if DSN is absent.
initObservability({
  sentry: {
    sdk: SentryRN as unknown as SentrySdk,
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
    environment: process.env.APP_ENV ?? 'development',
    appKind: 'native' as const,
    tracesSampleRate: process.env.APP_ENV === 'production' ? 0.2 : 1.0,
    release: process.env.EXPO_PUBLIC_APP_VERSION ?? '1.1.1',
  },
  otel: process.env.EXPO_PUBLIC_OTEL_ENDPOINT
    ? {
        serviceName: 'ntask-mobile',
        endpoint: process.env.EXPO_PUBLIC_OTEL_ENDPOINT,
      }
    : undefined,
});

const SUPPORTED_LOCALES: Locale[] = ['en', 'fr', 'ar', 'es', 'zh', 'ja', 'de', 'pt'];

/**
 * Detect the device locale via expo-localization and fall back to 'en'.
 * Returns a Locale supported by @nself/i18n.
 */
function getDeviceLocale(): Locale {
  const code = _deviceLang;
  return (SUPPORTED_LOCALES.includes(code as Locale) ? code : 'en') as Locale;
}

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * App-level offline-sync driver. Rendered inside UrqlProvider so useOfflineSync's
 * mutation hooks have a live client; drains the persisted mutation queue on reconnect.
 * Renders nothing.
 */
function OfflineSyncDriver() {
  useOfflineSync();
  return null;
}

function AuthenticatedApp({ serverUrl, accessToken }: { serverUrl: string; accessToken: string }) {
  const client = useMemo(() => createUrqlClient(serverUrl, accessToken), [serverUrl, accessToken]);
  return (
    <UrqlProvider value={client}>
      <OfflineSyncDriver />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="List" component={ListScreen} />
        <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
      </Stack.Navigator>
    </UrqlProvider>
  );
}

function App() {
  const { serverUrl, accessToken, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <NselfI18nProvider locale={getDeviceLocale()}>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {accessToken && serverUrl ? (
              <Stack.Screen name="Home">
                {() => <AuthenticatedApp serverUrl={serverUrl} accessToken={accessToken} />}
              </Stack.Screen>
            ) : (
              <Stack.Screen name="Login" component={LoginScreen} />
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </NselfI18nProvider>
  );
}

// Sentry.wrap captures native crash reports (JS thread + native thread crashes).
// The wrapped component is the default export as required by Expo's AppEntry.js.
export default SentryRN.wrap(App);
