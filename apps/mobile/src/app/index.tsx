/**
 * Purpose: Root app entry — urql Provider, i18n, observability (Sentry + OTel),
 *          ThemeProvider, navigation stack, auth gate, deep link handler, push token registration.
 * Inputs: Auth state from useAuth hook (backed by @nself/auth-core); urql Client from @nself/graphql-client;
 *         EXPO_PUBLIC_SENTRY_DSN, EXPO_PUBLIC_OTEL_ENDPOINT, APP_ENV, EXPO_PUBLIC_APP_VERSION from build env.
 * Outputs: NavigationContainer with Login|Home|List|TaskDetail|Settings|Profile|Notifications screens,
 *          Sentry + OTel registered, ThemeProvider wrapping app, deep link handler registered.
 * Constraints: Shows Login if no access token; mirrors Flutter NTasksApp auth gate.
 *   ErrorBoundary: top-level + authenticated-subtree boundaries report to Sentry.
 *   @nself/ui is web-only (Radix/shadcn); native loading spinner stays RN ActivityIndicator.
 *   @nself/observability wired at module level with @sentry/react-native SDK injection.
 *   Sentry.wrap(App) used as default export for native crash capture (JS + native threads).
 *   PII scrubbing runs unconditionally via scrubEvent as beforeSend inside initObservability.
 *   @nself/i18n NselfI18nProvider wraps the tree; locale detected via expo-localization.
 *   RTL: initializeI18n() called at module level so I18nManager.forceRTL fires before first render.
 *   ThemeProvider: reads MMKV preference; propagates to all screens via useTheme().
 *   Deep links: ntask://list/:id and ntask://task/:id handled via Linking.
 * SPORT: Port of app/lib/app.dart + main.dart root (SDK 53 upgrade; E2 @nself/* wiring)
 */

import React, { useMemo, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
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
import { usePushToken } from '../hooks/usePushToken';
import { createUrqlClient } from '../lib/api';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LoginScreen } from './LoginScreen';
import { HomeScreen } from './HomeScreen';
import { ListScreen } from './ListScreen';
import { TaskDetailScreen } from './TaskDetailScreen';
import { SettingsScreen } from './SettingsScreen';
import { ProfileScreen } from './ProfileScreen';
import { NotificationsScreen } from './NotificationsScreen';
import { ListMembersScreen } from './ListMembersScreen';
import { AccountScreen } from './AccountScreen';
import { ChangeEmailScreen } from './ChangeEmailScreen';
import { ChangePasswordScreen } from './ChangePasswordScreen';
import { SessionsScreen } from './SessionsScreen';
import { MfaSetupScreen } from './MfaSetupScreen';
import { DeleteAccountScreen } from './DeleteAccountScreen';
import type { RootStackParamList } from '../types';
import { initializeI18n } from '../i18n';
import { ThemeProvider, getThemePreference, setThemePreference, type ThemePreference } from '../theme';

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
 * Sentry error reporter — shared onError callback for both ErrorBoundary instances.
 * Captures the component stack alongside the error for easier diagnosis.
 */
function sentryOnError(err: Error, info: React.ErrorInfo) {
  SentryRN.captureException(err, { extra: { componentStack: info.componentStack } });
}

/**
 * App-level offline-sync driver. Rendered inside UrqlProvider so useOfflineSync's
 * mutation hooks have a live client; drains the persisted mutation queue on reconnect.
 * Renders nothing.
 */
function OfflineSyncDriver() {
  useOfflineSync();
  return null;
}

/**
 * Parse ntask:// or https://task.nself.org deep link into navigation target.
 * Handles: ntask://list/:listId → List; ntask://task/:taskId → TaskDetail.
 */
function parseDeepLink(url: string): { screen: 'List'; params: { listId: string; listTitle: string } } | { screen: 'TaskDetail'; params: { taskId: string; listId: string } } | null {
  try {
    const stripped = url
      .replace(/^ntask:\/\//, '')
      .replace(/^https?:\/\/task\.nself\.org/, '');
    const segments = stripped.split('/').filter(Boolean);
    if (segments[0] === 'list' && segments[1]) return { screen: 'List', params: { listId: segments[1]!, listTitle: '' } };
    if (segments[0] === 'task' && segments[1]) return { screen: 'TaskDetail', params: { taskId: segments[1]!, listId: '' } };
    return null;
  } catch { return null; }
}

function AuthenticatedApp({ serverUrl, accessToken }: { serverUrl: string; accessToken: string }) {
  const client = useMemo(() => createUrqlClient(serverUrl, accessToken), [serverUrl, accessToken]);

  // Register Expo push token with backend (graceful no-op if permissions not granted)
  usePushToken({ userId: null, serverUrl, accessToken });

  return (
    <UrqlProvider value={client}>
      <OfflineSyncDriver />
      <ErrorBoundary onError={sentryOnError}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="List" component={ListScreen} />
          <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="ListMembers" component={ListMembersScreen} />
          <Stack.Screen name="Account" component={AccountScreen} />
          <Stack.Screen name="ChangeEmail" component={ChangeEmailScreen} />
          <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
          <Stack.Screen name="Sessions" component={SessionsScreen} />
          <Stack.Screen name="MfaSetup" component={MfaSetupScreen} />
          <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
        </Stack.Navigator>
      </ErrorBoundary>
    </UrqlProvider>
  );
}

function App() {
  const { serverUrl, accessToken, loading } = useAuth();
  const [themePreference, setThemePref] = useState<ThemePreference>(() => getThemePreference());
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  // Handle deep links — both cold-start (getInitialURL) and foreground (addEventListener)
  useEffect(() => {
    const handle = (url: string) => {
      const target = parseDeepLink(url);
      if (!target || !navigationRef.isReady()) return;
      navigationRef.navigate(target.screen, target.params as never);
    };
    void Linking.getInitialURL().then((url) => { if (url) handle(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
  }, [navigationRef]);

  const handlePreferenceChange = (pref: ThemePreference) => {
    setThemePreference(pref);
    setThemePref(pref);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <ErrorBoundary onError={sentryOnError}>
      <ThemeProvider preference={themePreference} onPreferenceChange={handlePreferenceChange}>
        <NselfI18nProvider locale={getDeviceLocale()}>
          <SafeAreaProvider>
            <NavigationContainer ref={navigationRef}>
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
      </ThemeProvider>
    </ErrorBoundary>
  );
}

// Sentry.wrap captures native crash reports (JS thread + native thread crashes).
// The wrapped component is the default export as required by Expo's AppEntry.js.
export default SentryRN.wrap(App);
