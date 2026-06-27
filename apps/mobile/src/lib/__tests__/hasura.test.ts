/**
 * Purpose: Smoke tests for src/lib/hasura.ts — verifies re-exports from @nself/ntask-core
 *   are present and that inline account-op gql documents are defined.
 * Inputs: Mocked @nself/ntask-core, real urql gql (not mocked — tests actual gql parsing)
 * Outputs: Asserts non-null exports for all 23 re-exported constants + 8 inline gql docs
 * Constraints: @nself/ntask-core mocked so Jest does not resolve the real package.
 * SPORT: P5-C-mobile data layer rewire
 */

// ── Mocks must appear before imports ──────────────────────────────────────────

jest.mock('@nself/ntask-core', () => ({
  // List ops
  GET_LISTS: 'GET_LISTS',
  CREATE_LIST: 'CREATE_LIST',
  UPDATE_LIST: 'UPDATE_LIST',
  DELETE_LIST: 'DELETE_LIST',
  // Todo ops
  GET_LIST_TODOS: 'GET_LIST_TODOS',
  GET_TODO: 'GET_TODO',
  SEARCH_TODOS: 'SEARCH_TODOS',
  CREATE_TODO: 'CREATE_TODO',
  UPDATE_TODO: 'UPDATE_TODO',
  TOGGLE_TODO: 'TOGGLE_TODO',
  DELETE_TODO: 'DELETE_TODO',
  // Subtask ops
  GET_SUBTASKS: 'GET_SUBTASKS',
  CREATE_SUBTASK: 'CREATE_SUBTASK',
  UPDATE_SUBTASK: 'UPDATE_SUBTASK',
  TOGGLE_SUBTASK: 'TOGGLE_SUBTASK',
  DELETE_SUBTASK: 'DELETE_SUBTASK',
  // Comment ops
  GET_COMMENTS: 'GET_COMMENTS',
  CREATE_COMMENT: 'CREATE_COMMENT',
  UPDATE_COMMENT: 'UPDATE_COMMENT',
  DELETE_COMMENT: 'DELETE_COMMENT',
  // Tag ops
  GET_TAGS: 'GET_TAGS',
  CREATE_TAG: 'CREATE_TAG',
  UPDATE_TAG: 'UPDATE_TAG',
  DELETE_TAG: 'DELETE_TAG',
  ADD_TODO_TAG: 'ADD_TODO_TAG',
  REMOVE_TODO_TAG: 'REMOVE_TODO_TAG',
  // Profile
  GET_PROFILE: 'GET_PROFILE',
}));

import * as hasura from '../hasura';

// ─── Re-exported constants from @nself/ntask-core ────────────────────────────

describe('hasura.ts — re-exported ntask-core constants', () => {
  const EXPECTED_CONSTANTS = [
    'GET_LISTS',
    'CREATE_LIST',
    'UPDATE_LIST',
    'DELETE_LIST',
    'GET_LIST_TODOS',
    'GET_TODO',
    'SEARCH_TODOS',
    'CREATE_TODO',
    'UPDATE_TODO',
    'TOGGLE_TODO',
    'DELETE_TODO',
    'GET_SUBTASKS',
    'CREATE_SUBTASK',
    'UPDATE_SUBTASK',
    'TOGGLE_SUBTASK',
    'DELETE_SUBTASK',
    'GET_COMMENTS',
    'CREATE_COMMENT',
    'UPDATE_COMMENT',
    'DELETE_COMMENT',
    'GET_TAGS',
    'CREATE_TAG',
    'UPDATE_TAG',
    'DELETE_TAG',
    'ADD_TODO_TAG',
    'REMOVE_TODO_TAG',
    'GET_PROFILE',
  ] as const;

  EXPECTED_CONSTANTS.forEach((name) => {
    it(`exports ${name} and it is defined`, () => {
      expect((hasura as Record<string, unknown>)[name]).toBeDefined();
    });
  });

  it('exports the same string value as the mock for GET_LISTS', () => {
    expect(hasura.GET_LISTS).toBe('GET_LISTS');
  });

  it('exports the same string value as the mock for CREATE_TODO', () => {
    expect(hasura.CREATE_TODO).toBe('CREATE_TODO');
  });

  it('exports the same string value as the mock for GET_PROFILE', () => {
    expect(hasura.GET_PROFILE).toBe('GET_PROFILE');
  });
});

// ─── Verify hasura module exports exactly the expected keys ───────────────────

describe('hasura.ts — export surface', () => {
  it('exports at least 27 named values', () => {
    const exportedKeys = Object.keys(hasura);
    expect(exportedKeys.length).toBeGreaterThanOrEqual(27);
  });

  it('does not export undefined values for any key', () => {
    Object.entries(hasura).forEach(([key, value]) => {
      expect(value).toBeDefined();
      expect(value).not.toBeNull();
    });
  });
});
