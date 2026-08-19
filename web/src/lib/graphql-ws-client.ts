/**
 * graphql-ws-client.ts — WebSocket subscription client for ɳTask
 *
 * Purpose:    Lazy-initialized graphql-ws client with auth + auto-reconnect.
 *             Auth token fetched from /api/auth/session on connect.
 * Inputs:     VITE_GRAPHQL_WS_URL env var; session cookie
 * Outputs:    Client singleton; reconnects automatically on disconnect
 * Constraints: Lazy init — no WS opened until first subscription
 * SPORT:      D-S5-T1
 */
import { createClient, type Client } from 'graphql-ws'

const WS_URL =
  import.meta.env['VITE_GRAPHQL_WS_URL'] ??
  (typeof window !== 'undefined'
    ? `wss://${window.location.host}/v1/graphql`
    : 'wss://localhost:8080/v1/graphql')

let wsClient: Client | null = null

/**
 * Get or create the singleton WS client.
 * Call this from useSubscription; do not call at module level.
 */
export function getWsClient(): Client {
  if (!wsClient) {
    wsClient = createClient({
      url: WS_URL,
      connectionParams: async () => {
        // Fetch the auth session to get the JWT token
        try {
          const res = await fetch('/api/auth/session', { credentials: 'include' })
          if (!res.ok) return {}
          const data = (await res.json()) as { user?: { token?: string }; token?: string }
          const token = data.token ?? data.user?.token
          return token ? { headers: { Authorization: `Bearer ${token}` } } : {}
        } catch {
          return {}
        }
      },
      retryAttempts: 10,
      shouldRetry: () => true,
    })
  }
  return wsClient
}

/**
 * Dispose the WS client singleton. Call on auth logout.
 */
export function disposeWsClient(): void {
  if (wsClient) {
    void wsClient.dispose()
    wsClient = null
  }
}

/**
 * Fallback subscription query for list todos.
 * Use SUBSCRIBE_LIST_TODOS from @nself/ntask-core when available.
 */
export const SUBSCRIBE_LIST_TODOS = /* GraphQL */ `
  subscription SubscribeListTodos($listId: uuid!) {
    np_todos(
      where: { list_id: { _eq: $listId } }
      order_by: { position: asc, created_at: asc }
    ) {
      id
      title
      completed
      priority
      due_date
      notes
      created_at
      updated_at
    }
  }
`
