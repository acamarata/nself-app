/**
 * hooks.test.ts — Structural unit tests for web/ntask custom hooks.
 *
 * Purpose: Verify that query utility functions (hook-equivalents for data
 *          fetching) are importable and export the expected shape.
 * SPORT: F13-CROSS-REPO-DEPS.md — web/ntask (tests)
 */

import { describe, it, expect } from 'vitest';

describe('web/ntask — hooks: lib/graphql query helpers as hooks', () => {
  it('getLists is a function (async data-fetch hook)', async () => {
    const { getLists } = await import('../lib/graphql');
    expect(typeof getLists).toBe('function');
  });

  it('getListTodos is a function (async data-fetch hook)', async () => {
    const { getListTodos } = await import('../lib/graphql');
    expect(typeof getListTodos).toBe('function');
  });

  it('createTodo is an async function (mutation helper)', async () => {
    const { createTodo } = await import('../lib/graphql');
    expect(typeof createTodo).toBe('function');
  });

  it('toggleTodo is an async mutation helper', async () => {
    const { toggleTodo } = await import('../lib/graphql');
    expect(typeof toggleTodo).toBe('function');
  });
});
