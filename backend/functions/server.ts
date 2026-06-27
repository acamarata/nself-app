// Purpose: HTTP server entrypoint for all Hasura Action + event trigger handlers.
//   Hasura calls this service for:
//     - Action handlers  → POST /api/actions/<name>
//     - Event triggers   → POST /events/<trigger>
//     - Cron triggers    → POST /cron/<name>
//   Routes map 1:1 with the handler URLs declared in actions.yaml,
//   event_triggers.yaml, and cron_triggers.yaml.
//
// Inputs: JSON payloads from Hasura GraphQL engine over Docker bridge network.
// Outputs: JSON responses consumed by Hasura, forwarded to the GraphQL client.
//
// Constraints:
//   - No external HTTP framework — uses Node.js built-in `http` module to keep the
//     image footprint minimal and avoid dependency drift.
//   - Each handler is a typed async function imported from its module.
//   - Unhandled routes return 404 JSON (never a plain string — Hasura requires JSON).
//   - All errors return Hasura-compatible { message } JSON with appropriate HTTP status.
//   - ACTION_HANDLER_URL in .env.example must be http://functions:3001 when this
//     service runs inside Docker (functions container on backend_network).
//
// Port: 3001 (matches ACTION_HANDLER_URL default for Docker; configurable via PORT env).
// SPORT: F08 backend functions; P5-W5-functions-service

import http from 'http';
import { Sentry } from './sentry';

// ── Import action handlers ─────────────────────────────────────────────────────
import { deleteAccount }     from './user-delete';
import { requestDataExport } from './user-export';
import {
  changeEmail,
  changePassword,
  listSessions,
  revokeSession,
  enableMfa,
  disableMfa,
} from './account-ops';
import {
  handleCreateListInvite,
  handleAcceptListInvite,
  handleDeclineListInvite,
  handleRevokeListInvite,
  handleCreateShareLink,
  handleRevokeShareLink,
  handleUpdateMemberRole,
  handleRemoveMember,
  handleLeaveList,
  handleTransferOwnership,
  handleUpsertPresence,
  handleRemovePresence,
} from './collab-ops';
import { getUploadUrl, getDownloadUrl } from './storage-presign';
import { handleTaskActivity }            from './task-activity';
import { handleNotifyDispatch }          from './notify-dispatch';

// ── Types ─────────────────────────────────────────────────────────────────────

interface HasuraActionPayload {
  action: { name: string };
  session_variables: Record<string, string>;
  input: Record<string, unknown>;
}

// Each event handler defines its own local payload type (structural subtype).
// The server passes the raw JSON body through; handlers narrow to their type.
type AnyPayload = HasuraActionPayload | Record<string, unknown>;

// ── Route registry ─────────────────────────────────────────────────────────────

// Maps POST path → handler function
const actionRoutes: Record<
  string,
  (payload: HasuraActionPayload) => Promise<unknown>
> = {
  '/api/actions/delete-account':           deleteAccount,
  '/api/actions/export-data':              requestDataExport,
  '/api/actions/change-email':             changeEmail,
  '/api/actions/change-password':          changePassword,
  '/api/actions/list-sessions':            listSessions,
  '/api/actions/revoke-session':           revokeSession,
  '/api/actions/enable-mfa':              enableMfa,
  '/api/actions/disable-mfa':             disableMfa,
  '/api/actions/invite-create':            handleCreateListInvite,
  '/api/actions/invite-accept':            handleAcceptListInvite,
  '/api/actions/invite-decline':           handleDeclineListInvite,
  '/api/actions/invite-revoke':            handleRevokeListInvite,
  '/api/actions/share-create':             handleCreateShareLink,
  '/api/actions/share-revoke':             handleRevokeShareLink,
  '/api/actions/member-role-update':       handleUpdateMemberRole,
  '/api/actions/member-remove':            handleRemoveMember,
  '/api/actions/list-leave':               handleLeaveList,
  '/api/actions/list-transfer-ownership':  handleTransferOwnership,
  '/api/actions/presence-upsert':          handleUpsertPresence,
  '/api/actions/presence-remove':          handleRemovePresence,
  '/api/actions/get-upload-url':           getUploadUrl,
  '/api/actions/get-download-url':         getDownloadUrl,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const eventRoutes: Record<string, (payload: any) => Promise<unknown>> = {
  '/events/task-activity':   handleTaskActivity,
  '/events/notify-dispatch': handleNotifyDispatch,
};

// Cron handlers return void; we acknowledge with { success: true }
const cronRoutes: Record<string, () => Promise<void>> = {
  // Hasura cron triggers POST to these paths; handlers are
  // defined in functions triggered via Hasura's own cron engine
  // (the DB-backed cron_triggers.yaml). For now these stubs log and succeed.
  '/cron/create-recurring-instances': async () => { console.log('[cron] create-recurring-instances fired'); },
  '/cron/dispatch-reminders':         async () => { console.log('[cron] dispatch-reminders fired'); },
  '/cron/cleanup':                    async () => { console.log('[cron] cleanup fired'); },
};

// ── JSON helpers ──────────────────────────────────────────────────────────────

function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body) as Record<string, unknown>);
      } catch (err) {
        reject(new Error(`Invalid JSON body: ${(err as Error).message}`));
      }
    });
    req.on('error', reject);
  });
}

function jsonResponse(
  res: http.ServerResponse,
  status: number,
  body: unknown
): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}

function hasuraError(
  res: http.ServerResponse,
  status: number,
  message: string,
  extensions?: Record<string, unknown>
): void {
  jsonResponse(res, status, { message, extensions });
}

// ── Request handler ───────────────────────────────────────────────────────────

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  const url   = req.url ?? '/';
  const method = req.method ?? 'GET';

  // Health probe — used by Docker healthcheck and nself doctor
  if (url === '/health' || url === '/healthz') {
    jsonResponse(res, 200, { status: 'ok', service: 'ntask-functions' });
    return;
  }

  if (method !== 'POST') {
    hasuraError(res, 405, 'Method not allowed — only POST');
    return;
  }

  let body: Record<string, unknown>;
  try {
    body = await readBody(req);
  } catch (err) {
    hasuraError(res, 400, (err as Error).message);
    return;
  }

  // ── Action routes ──────────────────────────────────────────────────────────
  const actionHandler = actionRoutes[url];
  if (actionHandler) {
    try {
      const result = await actionHandler(body as unknown as HasuraActionPayload);
      jsonResponse(res, 200, result);
    } catch (err) {
      const e = err as Error & { extensions?: Record<string, unknown> };
      const status = (e.extensions?.['httpStatus'] as number | undefined) ?? 500;
      Sentry.captureException(err, { tags: { route: url } });
      hasuraError(res, status, e.message, e.extensions);
    } finally {
      await Sentry.flush(1000);
    }
    return;
  }

  // ── Event trigger routes ───────────────────────────────────────────────────
  const eventHandler = eventRoutes[url];
  if (eventHandler) {
    try {
      const result = await eventHandler(body);
      jsonResponse(res, 200, result ?? { success: true });
    } catch (err) {
      const e = err as Error;
      Sentry.captureException(err, { tags: { route: url } });
      // Return 200 for event triggers to prevent infinite Hasura retries
      // on non-retriable errors. Log the failure.
      console.error(`[event] ${url} failed:`, e.message);
      jsonResponse(res, 200, { success: false, error: e.message });
    } finally {
      await Sentry.flush(1000);
    }
    return;
  }

  // ── Cron trigger routes ────────────────────────────────────────────────────
  const cronHandler = cronRoutes[url];
  if (cronHandler) {
    try {
      await cronHandler();
      jsonResponse(res, 200, { success: true });
    } catch (err) {
      const e = err as Error;
      Sentry.captureException(err, { tags: { route: url } });
      console.error(`[cron] ${url} failed:`, e.message);
      jsonResponse(res, 200, { success: false, error: e.message });
    } finally {
      await Sentry.flush(1000);
    }
    return;
  }

  // Not found
  hasuraError(res, 404, `No handler registered for POST ${url}`);
}

// ── Server bootstrap ──────────────────────────────────────────────────────────

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    console.error('[server] unhandled error:', err);
    try {
      hasuraError(res, 500, 'Internal server error');
    } catch {
      // Response already sent
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[ntask-functions] listening on 0.0.0.0:${PORT}`);
  console.log(`[ntask-functions] ${Object.keys(actionRoutes).length} action routes, ${Object.keys(eventRoutes).length} event routes, ${Object.keys(cronRoutes).length} cron routes`);
});

server.on('error', (err) => {
  console.error('[server] fatal error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[ntask-functions] SIGTERM received, shutting down...');
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  console.log('[ntask-functions] SIGINT received, shutting down...');
  server.close(() => process.exit(0));
});
