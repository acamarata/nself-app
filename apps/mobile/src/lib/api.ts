/**
 * Purpose: nSelf backend GraphQL client factory and server URL persistence
 * Inputs: serverUrl string, accessToken string
 * Outputs: ApolloClient instance configured for Hasura GraphQL endpoint
 * Constraints: Mirrors Flutter BackendService._graphql — same endpoint, same auth header
 * SPORT: Replaces app/lib/services/backend_service.dart GraphQL layer
 */

import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import * as SecureStore from 'expo-secure-store';

const SERVER_URL_KEY = 'ntask_server_url';

export async function getServerUrl(): Promise<string | null> {
  return SecureStore.getItemAsync(SERVER_URL_KEY);
}

export async function setServerUrl(url: string): Promise<void> {
  const cleaned = url.trim().replace(/\/$/, '');
  await SecureStore.setItemAsync(SERVER_URL_KEY, cleaned);
}

export function createApolloClient(serverUrl: string, accessToken: string): ApolloClient<object> {
  const httpLink = createHttpLink({ uri: `${serverUrl}/v1/graphql` });
  const authLink = setContext((_, { headers }) => ({
    headers: { ...headers, Authorization: `Bearer ${accessToken}` },
  }));
  return new ApolloClient({
    link: authLink.concat(httpLink),
    cache: new InMemoryCache(),
    defaultOptions: { watchQuery: { fetchPolicy: 'cache-and-network' } },
  });
}
