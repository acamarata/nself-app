/**
 * getActiveSession — endpoint resolution when a session is already stored.
 *
 * The regression this pins: `--endpoint prod` used to be ignored whenever a
 * credentials file existed, because the stored profile's URLs always won. The
 * CLI then queried whatever host the last login used (usually a local stack) and
 * reported "fetch failed", looking for all the world like production was down.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PROFILE_PRESETS } from '../src/lib/config.js';

vi.mock('../src/lib/credentials.js', () => ({
  loadSession: () => ({
    accessToken: 'stored-token',
    refreshToken: 'stored-refresh',
    apiUrl: 'http://localhost:8080/v1/graphql',
    authUrl: 'http://localhost:4000',
  }),
}));

const { getActiveSession } = await import('../src/lib/session.js');

describe('getActiveSession', () => {
  const originalEnv = { ...process.env };
  beforeEach(() => { delete process.env.NTASK_TOKEN; });
  afterEach(() => { process.env = { ...originalEnv }; });

  it('uses the stored endpoints when no override is given', () => {
    const s = getActiveSession({});
    expect(s.apiUrl).toBe('http://localhost:8080/v1/graphql');
    expect(s.token).toBe('stored-token');
  });

  it('an explicit --endpoint wins over the stored profile', () => {
    const s = getActiveSession({ endpoint: 'prod' });
    expect(s.apiUrl).toBe(PROFILE_PRESETS.prod.apiUrl);
    expect(s.authUrl).toBe(PROFILE_PRESETS.prod.authUrl);
    expect(s.profileName).toBe('prod');
  });

  it('an explicit --api-url wins over everything', () => {
    const s = getActiveSession({ endpoint: 'prod', apiUrl: 'https://example.test/v1/graphql' });
    expect(s.apiUrl).toBe('https://example.test/v1/graphql');
  });

  it('NTASK_TOKEN skips stored credentials entirely', () => {
    process.env.NTASK_TOKEN = 'env-token';
    const s = getActiveSession({ endpoint: 'prod' });
    expect(s.token).toBe('env-token');
    expect(s.apiUrl).toBe(PROFILE_PRESETS.prod.apiUrl);
  });
});
