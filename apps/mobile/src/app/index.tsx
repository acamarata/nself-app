/**
 * Purpose: Root app entry — Apollo provider, navigation stack, auth gate
 * Inputs: Auth state from useAuth hook; ApolloClient built from serverUrl + token
 * Outputs: NavigationContainer with Login|Home|List|TaskDetail screens
 * Constraints: Shows Login if no access token; mirrors Flutter NTasksApp auth gate
 * SPORT: Port of app/lib/app.dart + main.dart root
 */

import React, { useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ApolloProvider } from '@apollo/client';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { createApolloClient } from '../lib/api';
import { LoginScreen } from './LoginScreen';
import { HomeScreen } from './HomeScreen';
import { ListScreen } from './ListScreen';
import { TaskDetailScreen } from './TaskDetailScreen';
import type { RootStackParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function AuthenticatedApp({ serverUrl, accessToken }: { serverUrl: string; accessToken: string }) {
  const client = useMemo(() => createApolloClient(serverUrl, accessToken), [serverUrl, accessToken]);
  return (
    <ApolloProvider client={client}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="List" component={ListScreen} />
        <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
      </Stack.Navigator>
    </ApolloProvider>
  );
}

export default function App() {
  const { serverUrl, accessToken, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
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
  );
}
