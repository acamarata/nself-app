// Purpose: Unit tests for the typed action errors that carry an HTTP status.
// Run: node --import tsx --test lib/__tests__/action-error.test.ts
// SPORT: F08 backend functions

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ActionError, badRequest, forbidden, unauthorized } from '../action-error';

describe('ActionError', () => {
  it('exposes extensions in the shape server.ts reads', () => {
    const err = new ActionError('nope', 'SOME_CODE', 418);
    assert.equal(err.message, 'nope');
    assert.equal(err.extensions.code, 'SOME_CODE');
    assert.equal(err.extensions['httpStatus'], 418);
    assert.ok(err instanceof Error);
  });

  it('merges extra fields without letting them shadow code/httpStatus', () => {
    const err = new ActionError('nope', 'CODE', 400, {
      retryAfterSeconds: 30,
      code: 'ATTACKER_SUPPLIED',
      httpStatus: 200,
    });
    assert.equal(err.extensions['retryAfterSeconds'], 30);
    assert.equal(err.extensions.code, 'CODE');
    assert.equal(err.extensions['httpStatus'], 400);
  });
});

describe('status helpers', () => {
  it('badRequest is 400', () => {
    assert.equal(badRequest('bad').extensions['httpStatus'], 400);
    assert.equal(badRequest('bad').extensions.code, 'BAD_REQUEST');
  });

  it('unauthorized is 401 — the missing-token path must not be a 500', () => {
    const err = unauthorized('Missing access token', 'MISSING_ACCESS_TOKEN');
    assert.equal(err.extensions['httpStatus'], 401);
    assert.equal(err.extensions.code, 'MISSING_ACCESS_TOKEN');
  });

  it('forbidden is 403', () => {
    assert.equal(forbidden('no').extensions['httpStatus'], 403);
  });

  it('server.ts status resolution picks the carried status over the 500 default', () => {
    // Mirrors the lookup in server.ts handleRequest.
    const resolve = (e: { extensions?: Record<string, unknown> }): number =>
      (e.extensions?.['httpStatus'] as number | undefined) ?? 500;

    assert.equal(resolve(unauthorized('x')), 401);
    assert.equal(resolve(badRequest('x')), 400);
    assert.equal(resolve(new Error('plain') as never), 500);
  });
});
