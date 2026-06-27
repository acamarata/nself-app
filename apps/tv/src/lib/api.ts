/**
 * Purpose: nSelf backend GraphQL client factory and server URL persistence for ɳTask TV.
 * Inputs: serverUrl string, accessToken string
 * Outputs: urql Client configured for Hasura GraphQL endpoint
 * Constraints:
 *   - Mirrors mobile lib/api.ts exactly — same pattern, same @nself/graphql-client.
 *   - Storage key uses 'ntask_tv_server_url' to isolate from mobile's key
 *     (they may run on the same device via TestFlight / AltStore).
 * SPORT: Epic F — TV scaffold.
 */

import { makeOperation, type Exchange } from '@urql/core';
import { pipe, map } from 'wonka';
import { NselfGraphqlClient } from '@nself/graphql-client';
import * as SecureStore from 'expo-secure-store';

const SERVER_URL_KEY = 'ntask_tv_server_url';

export async function getServerUrl(): Promise<string | null> {
  return SecureStore.getItemAsync(SERVER_URL_KEY);
}

export async function setServerUrl(url: string): Promise<void> {
  const cleaned = url.trim().replace(/\/$/, '');
  await SecureStore.setItemAsync(SERVER_URL_KEY, cleaned);
}

function makeBearerExchange(token: string): Exchange {
  return ({ forward }) =>
    (ops$) =>
      pipe(
        ops$,
        map((operation) =>
          makeOperation(operation.kind, operation, {
            ...operation.context,
            fetchOptions: () => {
              const existing =
                typeof operation.context.fetchOptions === 'function'
                  ? operation.context.fetchOptions()
                  : (operation.context.fetchOptions ?? {});
              return {
                ...existing,
                headers: {
                  ...(existing.headers as Record<string, string> | undefined),
                  Authorization: `Bearer ${token}`,
                },
              };
            },
          }),
        ),
        forward,
      );
}

export function createUrqlClient(serverUrl: string, accessToken: string) {
  const url = `${serverUrl}/v1/graphql`;
  return NselfGraphqlClient({
    url,
    authExchangeFn: () => makeBearerExchange(accessToken),
  });
}
