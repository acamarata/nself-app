/**
 * `ntask login <email>` — authenticate against hasura-auth and store tokens.
 *
 * Purpose:    Prompt for a password (hidden input, never echoed/logged),
 *             sign in via hasura-auth, and persist the resulting session
 *             under the resolved profile name in ~/.config/ntask/credentials.json.
 * Inputs:     email (positional), --endpoint/--api-url/--auth-url/--profile flags.
 * Outputs:    stdout confirmation (or JSON with --json); exit code 0 on
 *             success, 1 on auth failure.
 * Constraints: Password is read via a raw-mode stdin prompt that disables
 *             terminal echo — never printed, never included in error text.
 * SPORT:      n/a.
 */

import { createInterface } from 'node:readline';
import { login } from '../lib/client.js';
import { resolveEndpoints } from '../lib/config.js';
import { saveSession } from '../lib/credentials.js';
import { printInfo, printJson, printError } from '../lib/output.js';

function promptHiddenPassword(question: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    stdout.write(question);

    const rl = createInterface({ input: stdin, output: stdout, terminal: true });
    const rlAny = rl as unknown as { _writeToOutput: (s: string) => void };
    let muted = false;
    rlAny._writeToOutput = (stringToWrite: string) => {
      if (!muted) stdout.write(stringToWrite);
    };
    muted = true;

    rl.question('', (answer) => {
      rl.close();
      stdout.write('\n');
      resolve(answer);
    });
  });
}

export interface LoginOptions {
  readonly endpoint?: string;
  readonly apiUrl?: string;
  readonly authUrl?: string;
  readonly profile?: string;
  readonly password?: string;
  readonly json?: boolean;
}

export async function runLogin(email: string, opts: LoginOptions): Promise<number> {
  const { authUrl, apiUrl, profileName } = resolveEndpoints(opts, opts.profile);

  const password = opts.password ?? (await promptHiddenPassword('Password: '));

  try {
    const result = await login(authUrl, email, password);
    saveSession(profileName, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      userId: result.userId,
      email: result.email,
      apiUrl,
      authUrl,
      expiresAt: Date.now() + result.expiresIn * 1000,
    });

    if (opts.json) {
      printJson({ ok: true, profile: profileName, email: result.email, userId: result.userId });
    } else {
      printInfo(`Logged in as ${result.email} (profile: ${profileName})`);
    }
    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (opts.json) {
      printJson({ ok: false, error: message });
    } else {
      printError(message);
    }
    return 1;
  }
}
