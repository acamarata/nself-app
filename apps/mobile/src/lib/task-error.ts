/**
 * Purpose: Typed TaskError discriminated union with user-friendly messages
 * Inputs: TaskErrorType string literal; optional raw message
 * Outputs: TaskError object; userMessage() helper
 * Constraints: 5 variants per ticket spec; no external deps.
 * SPORT: T-P3-E5-W3-S1-T01-c
 */

export type TaskErrorType = 'network' | 'server' | 'auth' | 'rate_limit' | 'validation';

export interface TaskError {
  type: TaskErrorType;
  /** Raw technical message (for logging, not display) */
  message: string;
  /** Seconds until retry for rate_limit errors */
  retryAfter?: number;
}

const USER_MESSAGES: Record<TaskErrorType, string> = {
  network: 'No connection — your change will sync when you reconnect.',
  server: 'Server error — please try again in a moment.',
  auth: 'Session expired — please sign in again.',
  rate_limit: 'Too many requests — please wait before trying again.',
  validation: 'Invalid input — please check your entry and try again.',
};

export function taskUserMessage(error: TaskError): string {
  if (error.type === 'rate_limit' && error.retryAfter) {
    return `Too many requests — retrying in ${error.retryAfter}s`;
  }
  return USER_MESSAGES[error.type];
}

export function classifyUrqlError(error: unknown): TaskError {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('rate') || message.includes('429')) {
    return { type: 'rate_limit', message };
  }
  if (message.includes('auth') || message.includes('401') || message.includes('403') || message.includes('jwt')) {
    return { type: 'auth', message };
  }
  const msgLower = message.toLowerCase();
  if (
    msgLower.includes('network') ||
    msgLower.includes('fetch') ||
    msgLower.includes('econnrefused') ||
    msgLower.includes('connection') ||
    msgLower.includes('timeout') ||
    msgLower.includes('offline')
  ) {
    return { type: 'network', message };
  }
  return { type: 'server', message };
}
