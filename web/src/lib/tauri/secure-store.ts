/**
 * Purpose: TauriSecureStore — OS-keychain-backed SecureStore for Tauri desktop.
 * Inputs:  secure_store_* IPC commands via invoke() from core.
 * Outputs: SecureStoreInterface + SecureStoreError + TauriSecureStore.
 * Constraints: Throws SecureStoreError on failure (not Result) — mirrors
 *              @nself/native-bridge's SecureStoreError contract.
 * SPORT: F13-CROSS-REPO-DEPS — replaces E-S1-T3 dep edge (web/ntask → @nself/tauri-bridge).
 */
import { invoke, isErr } from './core';

/**
 * SecureStoreInterface — canonical get/set/delete contract.
 * Identical shape to @nself/auth-core SecureStoreInterface and
 * @nself/native-bridge's ExpoSecureStore contract.
 */
export interface SecureStoreInterface {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * SecureStoreError — thrown by TauriSecureStore on backend failure.
 * Mirrors @nself/native-bridge's SecureStoreError.
 */
export class SecureStoreError extends Error {
  override readonly name = 'SecureStoreError';
  override readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.cause = cause;
  }
}

const SECURE_STORE_CMD = {
  get: 'secure_store_get',
  set: 'secure_store_set',
  delete: 'secure_store_delete',
} as const;

/**
 * TauriSecureStore — OS-keychain-backed SecureStore for Tauri desktop.
 * Satisfies SecureStoreInterface; throws SecureStoreError on failure (not Result).
 */
export class TauriSecureStore implements SecureStoreInterface {
  async get(key: string): Promise<string | null> {
    const result = await invoke<string | null>(SECURE_STORE_CMD.get, { key });
    if (isErr(result)) {
      throw new SecureStoreError(`TauriSecureStore.get failed for key "${key}"`, result.error);
    }
    return result.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    const result = await invoke<void>(SECURE_STORE_CMD.set, { key, value });
    if (isErr(result)) {
      throw new SecureStoreError(`TauriSecureStore.set failed for key "${key}"`, result.error);
    }
  }

  async delete(key: string): Promise<void> {
    const result = await invoke<void>(SECURE_STORE_CMD.delete, { key });
    if (isErr(result)) {
      throw new SecureStoreError(`TauriSecureStore.delete failed for key "${key}"`, result.error);
    }
  }
}
