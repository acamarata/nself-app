import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('getSession', () => {
  const originalEnv = { ...process.env };
  let fakeHome: string;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.NTASK_TOKEN;
    delete process.env.NTASK_EMAIL;
    delete process.env.NTASK_PASSWORD;
    delete process.env.NTASK_API_URL;
    delete process.env.NTASK_AUTH_URL;
    delete process.env.NTASK_ENDPOINT;
    // Isolate from any real ~/.config/ntask/credentials.json on the dev machine.
    fakeHome = mkdtempSync(join(tmpdir(), 'ntask-mcp-test-'));
    process.env.HOME = fakeHome;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    rmSync(fakeHome, { recursive: true, force: true });
  });

  it('resolves directly from NTASK_TOKEN without calling login', async () => {
    process.env.NTASK_TOKEN = 'test-token-123';
    process.env.NTASK_API_URL = 'http://localhost:8080/v1/graphql';
    process.env.NTASK_AUTH_URL = 'http://localhost:4000';

    const { getSession } = await import('../src/session.js');
    const session = await getSession();

    expect(session.token).toBe('test-token-123');
    expect(session.apiUrl).toBe('http://localhost:8080/v1/graphql');
  });

  it('throws an actionable error when no credentials are configured', async () => {
    // No NTASK_TOKEN, no NTASK_EMAIL/PASSWORD, and (in CI) no stored credentials file.
    const { getSession } = await import('../src/session.js');
    await expect(getSession()).rejects.toThrow(/ntask login|NTASK_TOKEN/);
  });
});
