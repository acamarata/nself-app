/**
 * Purpose: 7-state screen-state hook for consistent UX across all data panels.
 * States: loading | empty | error | offline | rate-limit | permission | content.
 * Inputs: loading flag, data array/null, error from API calls.
 * Outputs: { state, isLoading, isEmpty, isError, isOffline } discriminated state.
 * Constraints: SSR-safe (navigator.onLine fallback).
 * SPORT: D2-S1-T1 useScreenState hook.
 */

export type ScreenState =
  | 'loading'
  | 'empty'
  | 'error'
  | 'offline'
  | 'rate-limit'
  | 'permission'
  | 'content';

export interface ScreenStateResult {
  state: ScreenState;
  isLoading: boolean;
  isEmpty: boolean;
  isError: boolean;
  isOffline: boolean;
}

export interface ScreenStateOptions {
  loading: boolean;
  /** Pass null/undefined when data has not yet loaded */
  data: unknown[] | null | undefined;
  error?: Error | string | null;
  /** True when error is a 403/permission-denied */
  isPermissionError?: boolean;
  /** True when error is a 429/rate-limited */
  isRateLimitError?: boolean;
}

export function useScreenState(opts: ScreenStateOptions): ScreenStateResult {
  const isOffline =
    typeof navigator !== 'undefined' ? !navigator.onLine : false;

  if (opts.loading && !opts.data) {
    return { state: 'loading', isLoading: true, isEmpty: false, isError: false, isOffline };
  }
  if (isOffline && !opts.data?.length) {
    return { state: 'offline', isLoading: false, isEmpty: false, isError: false, isOffline: true };
  }
  if (opts.isRateLimitError) {
    return { state: 'rate-limit', isLoading: false, isEmpty: false, isError: true, isOffline };
  }
  if (opts.isPermissionError) {
    return { state: 'permission', isLoading: false, isEmpty: false, isError: true, isOffline };
  }
  if (opts.error) {
    return { state: 'error', isLoading: false, isEmpty: false, isError: true, isOffline };
  }
  if (!opts.data || opts.data.length === 0) {
    return { state: 'empty', isLoading: opts.loading, isEmpty: true, isError: false, isOffline };
  }
  return { state: 'content', isLoading: false, isEmpty: false, isError: false, isOffline };
}
