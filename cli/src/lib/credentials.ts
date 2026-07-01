/**
 * On-disk credential storage for the ɳTask CLI.
 *
 * Purpose:    Persist per-profile access/refresh tokens at
 *             ~/.config/ntask/credentials.json so `ntask login` survives
 *             across invocations without re-prompting for a password.
 * Inputs:     Profile name + session tokens from hasura-auth signin response.
 * Outputs:    Read/write helpers; file is created with mode 0600 and the
 *             parent dir with 0700. Never logs or prints token values.
 * Constraints: Never store plaintext passwords — only bearer/refresh tokens.
 *             Multiple profiles (local/staging/prod) coexist in one file,
 *             keyed by profile name, with an `activeProfile` pointer.
 * SPORT:      n/a (local CLI state, not a tracked domain entity).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export interface StoredSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly userId: string;
  readonly email: string;
  readonly apiUrl: string;
  readonly authUrl: string;
  readonly expiresAt: number;
}

interface CredentialsFile {
  activeProfile: string;
  profiles: Record<string, StoredSession>;
}

export function credentialsPath(): string {
  return join(homedir(), '.config', 'ntask', 'credentials.json');
}

function ensureConfigDir(): void {
  const dir = dirname(credentialsPath());
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

function readAll(): CredentialsFile {
  const path = credentialsPath();
  if (!existsSync(path)) {
    return { activeProfile: 'local', profiles: {} };
  }
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw) as CredentialsFile;
    return { activeProfile: parsed.activeProfile ?? 'local', profiles: parsed.profiles ?? {} };
  } catch {
    return { activeProfile: 'local', profiles: {} };
  }
}

function writeAll(data: CredentialsFile): void {
  ensureConfigDir();
  const path = credentialsPath();
  writeFileSync(path, JSON.stringify(data, null, 2), { mode: 0o600 });
  chmodSync(path, 0o600);
}

/** Save a session for a profile and mark it active. */
export function saveSession(profile: string, session: StoredSession): void {
  const data = readAll();
  data.profiles[profile] = session;
  data.activeProfile = profile;
  writeAll(data);
}

/** Load the session for a named profile, or the active profile if omitted. */
export function loadSession(profile?: string): StoredSession | undefined {
  const data = readAll();
  const key = profile ?? data.activeProfile;
  return data.profiles[key];
}

/** Name of the currently active profile. */
export function activeProfileName(): string {
  return readAll().activeProfile;
}

/** Remove a stored session (logout). Clears active profile pointer if it matches. */
export function clearSession(profile?: string): void {
  const data = readAll();
  const key = profile ?? data.activeProfile;
  delete data.profiles[key];
  writeAll(data);
}
