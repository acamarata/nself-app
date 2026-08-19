/**
 * lib.test.ts — Unit tests for web/ntask lib utilities (i18n + graphql).
 *
 * Purpose: Verify translation helper and GraphQL query helper module exports.
 * SPORT: F13-CROSS-REPO-DEPS.md — web/ntask (tests)
 */

import { describe, it, expect } from 'vitest';
import { useT, DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../lib/i18n';

// ─── i18n.ts ─────────────────────────────────────────────────────────────────

describe('web/ntask — lib/i18n', () => {
  it('DEFAULT_LOCALE is "en"', () => {
    expect(DEFAULT_LOCALE).toBe('en');
  });

  it('SUPPORTED_LOCALES includes en and ar', () => {
    expect(SUPPORTED_LOCALES).toContain('en');
    expect(SUPPORTED_LOCALES).toContain('ar');
  });

  it('useT returns a function', () => {
    const t = useT('common');
    expect(typeof t).toBe('function');
  });

  it('resolves known key from common namespace', () => {
    const t = useT('common');
    const result = t('loading');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('falls back to key for missing translation', () => {
    const t = useT('common');
    expect(t('does.not.exist.at.all')).toBe('does.not.exist.at.all');
  });

  it('unknown namespace returns key fallback', () => {
    const t = useT('nonexistent-ns');
    expect(t('some.key')).toBe('some.key');
  });
});

// ─── graphql.ts module structure ─────────────────────────────────────────────
// Actual exports: getLists, getListTodos, createList, updateList, createTodo, updateTodo, toggleTodo

describe('web/ntask — lib/graphql module exports', () => {
  it('exports getLists function', async () => {
    const mod = await import('../lib/graphql');
    expect(typeof mod.getLists).toBe('function');
  });

  it('exports getListTodos function', async () => {
    const mod = await import('../lib/graphql');
    expect(typeof mod.getListTodos).toBe('function');
  });

  it('exports createList function', async () => {
    const mod = await import('../lib/graphql');
    expect(typeof mod.createList).toBe('function');
  });

  it('exports createTodo function', async () => {
    const mod = await import('../lib/graphql');
    expect(typeof mod.createTodo).toBe('function');
  });
});
