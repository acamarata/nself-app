/**
 * Purpose: Root TV navigation stack for ɳTask TV.
 * Inputs: Auth state from useTVAuth hook.
 * Outputs: Stack with Connect → Dashboard → ListView → TaskDetail screens.
 * Constraints:
 *   - Uses @react-navigation/native-stack (same as mobile) — no TV-specific nav lib needed
 *     because UIFocusEngine handles all D-pad routing between components; navigation is
 *     screen-level only and triggered programmatically by button presses.
 *   - All screens are landscape, headerShown: false — TV UI renders its own chrome.
 *   - Menu/Back button on remote triggers navigation.goBack() via the built-in
 *     TVEventHandler (react-native-tvos ships this as a named export).
 * SPORT: Epic F — TV scaffold.
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as UrqlProvider } from 'urql';
import { ConnectScreen } from '../screens/ConnectScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ListViewScreen } from '../screens/ListViewScreen';
import { TaskDetailScreen } from '../screens/TaskDetailScreen';
import { FocusProvider } from './FocusContext';
import { useTVAuth } from '../hooks/useTVAuth';
import { createUrqlClient } from '../lib/api';

export type TVStackParamList = {
  Connect: undefined;
  Dashboard: undefined;
  ListView: { listId: string; listTitle: string; bucket?: 'today' | 'overdue' | 'upcoming' };
  TaskDetail: { taskId: string; listId: string };
};

const Stack = createNativeStackNavigator<TVStackParamList>();

function AuthenticatedApp({
  serverUrl,
  accessToken,
}: {
  serverUrl: string;
  accessToken: string;
}) {
  const client = React.useMemo(
    () => createUrqlClient(serverUrl, accessToken),
    [serverUrl, accessToken],
  );

  return (
    <UrqlProvider value={client}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="ListView" component={ListViewScreen} />
        <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
      </Stack.Navigator>
    </UrqlProvider>
  );
}

export function TVNavigator() {
  const { serverUrl, accessToken, loading } = useTVAuth();

  if (loading) {
    // Minimal loading state — TVLoadingScreen not needed here; ConnectScreen handles
    // the pairing flow and will redirect once auth resolves.
    return null;
  }

  return (
    <FocusProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
          {accessToken && serverUrl ? (
            <Stack.Screen name="Dashboard">
              {() => <AuthenticatedApp serverUrl={serverUrl} accessToken={accessToken} />}
            </Stack.Screen>
          ) : (
            <Stack.Screen name="Connect" component={ConnectScreen} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </FocusProvider>
  );
}
