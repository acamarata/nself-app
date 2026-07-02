import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveEndpoints, PROFILE_PRESETS } from '../src/lib/config.js';

describe('resolveEndpoints', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.NTASK_API_URL;
    delete process.env.NTASK_AUTH_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('defaults to the local preset', () => {
    const result = resolveEndpoints({});
    expect(result.apiUrl).toBe(PROFILE_PRESETS.local.apiUrl);
    expect(result.authUrl).toBe(PROFILE_PRESETS.local.authUrl);
    expect(result.profileName).toBe('local');
  });

  it('resolves the staging preset by name', () => {
    const result = resolveEndpoints({ endpoint: 'staging' });
    expect(result.apiUrl).toBe(PROFILE_PRESETS.staging.apiUrl);
    expect(result.profileName).toBe('staging');
  });

  it('prefers explicit apiUrl/authUrl overrides over the preset', () => {
    const result = resolveEndpoints({ endpoint: 'local', apiUrl: 'http://x/graphql', authUrl: 'http://x/auth' });
    expect(result.apiUrl).toBe('http://x/graphql');
    expect(result.authUrl).toBe('http://x/auth');
  });

  it('falls back to env vars when no explicit override is given', () => {
    process.env.NTASK_API_URL = 'http://env/graphql';
    process.env.NTASK_AUTH_URL = 'http://env/auth';
    const result = resolveEndpoints({});
    expect(result.apiUrl).toBe('http://env/graphql');
    expect(result.authUrl).toBe('http://env/auth');
  });

  it('falls back to an unknown preset name resolving to local', () => {
    const result = resolveEndpoints({ endpoint: 'nonexistent' });
    expect(result.apiUrl).toBe(PROFILE_PRESETS.local.apiUrl);
  });
});
