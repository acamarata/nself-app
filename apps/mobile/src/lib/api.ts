/**
 * Purpose: nSelf backend GraphQL client factory and server URL persistence
 * Inputs: serverUrl string, accessToken string
 * Outputs: urql Client instance configured for Hasura GraphQL endpoint via @nself/graphql-client
 * Constraints: Talks to the Hasura GraphQL endpoint with a Bearer access token —
 *   this file is the definition of that contract.
 *   Uses @nself/graphql-client (urql) per D-P3-REACT19 / E2 package wiring.
 *   Token injection: static Bearer token via a lightweight exchange closure (AuthExchangeFn).
 *   Auth-core NativeAuthStrategy manages SecureStore lifecycle in useAuth.ts.
 *   getServerUrl() falls back to build-time EXPO_PUBLIC_DEFAULT_SERVER_URL (set in eas.json /
 *   .env) when no server has been persisted yet — lets prod/preview builds ship pre-wired to
 *   api.task.nself.org while self-host users can still override at first login.
 * SPORT: Replaces hand-rolled ApolloClient; @nself/graphql-client wraps urql (SDK 53 upgrade)
 */

import { makeOperation, type Exchange } from '@urql/core';
import { pipe, map } from 'wonka';
import { NselfGraphqlClient } from '@nself/graphql-client';
import * as SecureStore from 'expo-secure-store';

const SERVER_URL_KEY = 'ntask_server_url';

export async function getServerUrl(): Promise<string | null> {
  const stored = await SecureStore.getItemAsync(SERVER_URL_KEY);
  if (stored) return stored;
  const buildDefault = process.env.EXPO_PUBLIC_DEFAULT_SERVER_URL;
  return buildDefault ? buildDefault.trim().replace(/\/$/, '') : null;
}

export async function setServerUrl(url: string): Promise<void> {
  const cleaned = url.trim().replace(/\/$/, '');
  await SecureStore.setItemAsync(SERVER_URL_KEY, cleaned);
}

/**
 * makeBearerExchange — urql exchange that injects a static Bearer token header.
 * Used when the token is already resolved (post-auth), so no refresh loop needed.
 * Returns an Exchange — compatible with AuthExchangeFn (which returns Exchange).
 */
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

/**
 * createUrqlClient — build a urql Client for the given server + access token.
 * The Bearer token is injected via a static exchange (no auth-exchange refresh needed:
 * auth-core NativeAuthStrategy in useAuth triggers a re-render + new client on token change).
 */
export function createUrqlClient(serverUrl: string, accessToken: string) {
  const url = `${serverUrl}/v1/graphql`;
  return NselfGraphqlClient({
    url,
    authExchangeFn: () => makeBearerExchange(accessToken),
  });
}
