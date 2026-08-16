// Purpose: Unit tests for the functions webhook shared-secret guard.
// Run: node --import tsx --test lib/__tests__/webhook-auth.test.ts
// SPORT: F08 backend functions

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isAuthorisedCaller,
  readSecretHeader,
  secretMatches,
  WEBHOOK_HEADER,
} from '../webhook-auth';

const SECRET = 'c0ffee'.repeat(8);

describe('secretMatches', () => {
  it('accepts an exact match', () => {
    assert.equal(secretMatches(SECRET, SECRET), true);
  });

  it('rejects a different value of the same length', () => {
    const wrong = 'deadbe'.repeat(8);
    assert.equal(wrong.length, SECRET.length);
    assert.equal(secretMatches(wrong, SECRET), false);
  });

  it('rejects a prefix without throwing on the length mismatch', () => {
    assert.equal(secretMatches(SECRET.slice(0, 10), SECRET), false);
  });

  it('rejects a longer value', () => {
    assert.equal(secretMatches(`${SECRET}extra`, SECRET), false);
  });

  it('rejects an empty provided value', () => {
    assert.equal(secretMatches('', SECRET), false);
  });
});

describe('readSecretHeader', () => {
  it('reads a plain header', () => {
    assert.equal(readSecretHeader({ [WEBHOOK_HEADER]: SECRET }), SECRET);
  });

  it('takes the first value when the header repeats', () => {
    assert.equal(readSecretHeader({ [WEBHOOK_HEADER]: [SECRET, 'other'] }), SECRET);
  });

  it('returns an empty string when absent', () => {
    assert.equal(readSecretHeader({}), '');
  });

  it('returns an empty string for an empty array', () => {
    assert.equal(readSecretHeader({ [WEBHOOK_HEADER]: [] }), '');
  });
});

describe('isAuthorisedCaller', () => {
  it('rejects a request with no secret header when one is configured', () => {
    assert.equal(isAuthorisedCaller({}, SECRET), false);
  });

  it('rejects a request with the wrong secret', () => {
    assert.equal(isAuthorisedCaller({ [WEBHOOK_HEADER]: 'guess' }, SECRET), false);
  });

  it('accepts a request carrying the configured secret', () => {
    assert.equal(isAuthorisedCaller({ [WEBHOOK_HEADER]: SECRET }, SECRET), true);
  });

  it('does not accept a caller because some OTHER header matches', () => {
    assert.equal(isAuthorisedCaller({ authorization: `Bearer ${SECRET}` }, SECRET), false);
  });

  it('falls open when no secret is configured, so an upgrade does not go dark', () => {
    assert.equal(isAuthorisedCaller({}, ''), true);
  });
});
