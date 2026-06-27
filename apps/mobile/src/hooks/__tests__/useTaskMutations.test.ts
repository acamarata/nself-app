/**
 * Purpose: Unit tests for useTaskMutations, useSubtaskMutations, useCommentMutations,
 *   and useTagMutations hooks — urql is mocked; we test hook return shape, function types,
 *   default argument values, and idempotency context forwarding.
 * Inputs: Mocked useMutation returning controllable exec fns
 * Outputs: Asserts return shapes, function types, default args, idempotency headers
 * Constraints: Free plugins only. urql and hasura mocked at module level.
 *   jest.mock factory must not reference out-of-scope variables — use mockFn prefix.
 * SPORT: P5-C-mobile data layer rewire
 */

// ── Mocks must appear before imports ──────────────────────────────────────────
// NOTE: jest.mock factories are hoisted. Variables prefixed with `mock` (case-insensitive)
// are the only ones allowed inside factory callbacks.

jest.mock('urql', () => ({
  useMutation: jest.fn(() => [{ fetching: false }, jest.fn().mockResolvedValue({})]),
  useQuery: () => [{ data: null, fetching: false, error: undefined }, jest.fn()],
}));

jest.mock('../../lib/hasura', () => ({
  CREATE_TODO: 'CREATE_TODO',
  UPDATE_TODO: 'UPDATE_TODO',
  TOGGLE_TODO: 'TOGGLE_TODO',
  DELETE_TODO: 'DELETE_TODO',
  CREATE_LIST: 'CREATE_LIST',
  UPDATE_LIST: 'UPDATE_LIST',
  DELETE_LIST: 'DELETE_LIST',
  CREATE_SUBTASK: 'CREATE_SUBTASK',
  UPDATE_SUBTASK: 'UPDATE_SUBTASK',
  TOGGLE_SUBTASK: 'TOGGLE_SUBTASK',
  DELETE_SUBTASK: 'DELETE_SUBTASK',
  CREATE_COMMENT: 'CREATE_COMMENT',
  UPDATE_COMMENT: 'UPDATE_COMMENT',
  DELETE_COMMENT: 'DELETE_COMMENT',
  CREATE_TAG: 'CREATE_TAG',
  UPDATE_TAG: 'UPDATE_TAG',
  DELETE_TAG: 'DELETE_TAG',
  ADD_TODO_TAG: 'ADD_TODO_TAG',
  REMOVE_TODO_TAG: 'REMOVE_TODO_TAG',
}));

import { renderHook, act } from '@testing-library/react-native';
import { useMutation } from 'urql';
import {
  useTaskMutations,
  useSubtaskMutations,
  useCommentMutations,
  useTagMutations,
} from '../useTaskMutations';

const mockUseMutation = useMutation as jest.Mock;

/**
 * Helper: reset useMutation to produce fresh exec fns before each test.
 * Returns an ordered array of the exec fns that will be created on the next renderHook.
 */
function setupMutationExecs(count: number): jest.Mock[] {
  const execs: jest.Mock[] = Array.from({ length: count }, () =>
    jest.fn().mockResolvedValue({}),
  );
  let callIdx = 0;
  mockUseMutation.mockImplementation(() => {
    const exec = execs[callIdx] ?? jest.fn().mockResolvedValue({});
    callIdx++;
    return [{ fetching: false }, exec];
  });
  return execs;
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: each useMutation call returns a fresh jest.fn()
  mockUseMutation.mockImplementation(() => [{ fetching: false }, jest.fn().mockResolvedValue({})]);
});

// ─── useTaskMutations ─────────────────────────────────────────────────────────

describe('useTaskMutations', () => {
  it('returns all 8 expected keys', () => {
    const { result } = renderHook(() => useTaskMutations());
    const keys = Object.keys(result.current).sort();
    expect(keys).toEqual(
      ['creating', 'createTask', 'updateTask', 'toggleTask', 'deleteTask', 'createList', 'updateList', 'deleteList'].sort(),
    );
  });

  it('exposes creating as a boolean', () => {
    const { result } = renderHook(() => useTaskMutations());
    expect(typeof result.current.creating).toBe('boolean');
  });

  it('creating reflects the fetching state from useMutation', () => {
    mockUseMutation.mockReturnValueOnce([{ fetching: true }, jest.fn()]);
    // remaining calls return default
    const { result } = renderHook(() => useTaskMutations());
    expect(result.current.creating).toBe(true);
  });

  it('exposes all mutation helpers as functions', () => {
    const { result } = renderHook(() => useTaskMutations());
    const fns = ['createTask', 'updateTask', 'toggleTask', 'deleteTask', 'createList', 'updateList', 'deleteList'] as const;
    fns.forEach((fn) => {
      expect(typeof result.current[fn]).toBe('function');
    });
  });

  it('createList defaults color to #6366F1 when not supplied', async () => {
    // useTaskMutations calls useMutation 7 times; execCreateList is at index 4
    const execs = setupMutationExecs(7);
    const { result } = renderHook(() => useTaskMutations());

    await act(async () => {
      await result.current.createList('My list');
    });

    // No idempotencyKey passed → second arg is undefined (idempotencyContext returns undefined)
    expect(execs[4]).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'My list', color: '#6366F1' }),
      undefined,
    );
  });

  it('createList passes custom color when supplied', async () => {
    const execs = setupMutationExecs(7);
    const { result } = renderHook(() => useTaskMutations());

    await act(async () => {
      await result.current.createList('Work', '#FF0000');
    });

    expect(execs[4]).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Work', color: '#FF0000' }),
      undefined,
    );
  });

  it('createTask forwards idempotencyKey in fetchOptions.headers', async () => {
    // execCreate is the 1st useMutation call (index 0)
    const execs = setupMutationExecs(7);
    const { result } = renderHook(() => useTaskMutations('list-abc'));

    await act(async () => {
      await result.current.createTask('My task', 'key-xyz');
    });

    expect(execs[0]).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'My task', listId: 'list-abc' }),
      expect.objectContaining({
        fetchOptions: expect.objectContaining({
          headers: expect.objectContaining({ 'X-Idempotency-Key': 'key-xyz' }),
        }),
      }),
    );
  });

  it('createTask passes undefined context when no idempotencyKey', async () => {
    const execs = setupMutationExecs(7);
    const { result } = renderHook(() => useTaskMutations());

    await act(async () => {
      await result.current.createTask('No key task');
    });

    expect(execs[0]).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'No key task' }),
      undefined,
    );
  });

  it('accepts an optional listId forwarded to createTask variables', async () => {
    const execs = setupMutationExecs(7);
    const { result } = renderHook(() => useTaskMutations('list-42'));

    await act(async () => {
      await result.current.createTask('With list');
    });

    expect(execs[0]).toHaveBeenCalledWith(
      expect.objectContaining({ listId: 'list-42' }),
      undefined,
    );
  });

  it('deleteTask calls exec with id and optional idempotencyKey', async () => {
    const execs = setupMutationExecs(7);
    const { result } = renderHook(() => useTaskMutations());

    await act(async () => {
      await result.current.deleteTask('task-99', 'del-key');
    });

    // execDelete is the 4th useMutation call (index 3)
    expect(execs[3]).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'task-99' }),
      expect.objectContaining({ fetchOptions: expect.objectContaining({ headers: expect.anything() }) }),
    );
  });
});

// ─── useSubtaskMutations ──────────────────────────────────────────────────────

describe('useSubtaskMutations', () => {
  it('returns all 5 expected keys', () => {
    const { result } = renderHook(() => useSubtaskMutations());
    const keys = Object.keys(result.current).sort();
    expect(keys).toEqual(
      ['creating', 'createSubtask', 'updateSubtask', 'toggleSubtask', 'deleteSubtask'].sort(),
    );
  });

  it('exposes creating as a boolean', () => {
    const { result } = renderHook(() => useSubtaskMutations());
    expect(typeof result.current.creating).toBe('boolean');
  });

  it('exposes all mutation helpers as functions', () => {
    const { result } = renderHook(() => useSubtaskMutations());
    const fns = ['createSubtask', 'updateSubtask', 'toggleSubtask', 'deleteSubtask'] as const;
    fns.forEach((fn) => {
      expect(typeof result.current[fn]).toBe('function');
    });
  });

  it('createSubtask calls exec with todoId, title, and optional position', async () => {
    const execs = setupMutationExecs(4);
    const { result } = renderHook(() => useSubtaskMutations());

    await act(async () => {
      await result.current.createSubtask('todo-1', 'Sub item', 2);
    });

    expect(execs[0]).toHaveBeenCalledWith({ todoId: 'todo-1', title: 'Sub item', position: 2 });
  });
});

// ─── useCommentMutations ──────────────────────────────────────────────────────

describe('useCommentMutations', () => {
  it('returns all 4 expected keys', () => {
    const { result } = renderHook(() => useCommentMutations());
    const keys = Object.keys(result.current).sort();
    expect(keys).toEqual(
      ['creating', 'createComment', 'updateComment', 'deleteComment'].sort(),
    );
  });

  it('exposes creating as a boolean', () => {
    const { result } = renderHook(() => useCommentMutations());
    expect(typeof result.current.creating).toBe('boolean');
  });

  it('exposes all mutation helpers as functions', () => {
    const { result } = renderHook(() => useCommentMutations());
    const fns = ['createComment', 'updateComment', 'deleteComment'] as const;
    fns.forEach((fn) => {
      expect(typeof result.current[fn]).toBe('function');
    });
  });

  it('createComment calls exec with todoId and body', async () => {
    const execs = setupMutationExecs(3);
    const { result } = renderHook(() => useCommentMutations());

    await act(async () => {
      await result.current.createComment('todo-42', 'Great task!');
    });

    expect(execs[0]).toHaveBeenCalledWith(
      expect.objectContaining({ todoId: 'todo-42', body: 'Great task!' }),
    );
  });
});

// ─── useTagMutations ──────────────────────────────────────────────────────────

describe('useTagMutations', () => {
  it('returns all 6 expected keys', () => {
    const { result } = renderHook(() => useTagMutations());
    const keys = Object.keys(result.current).sort();
    expect(keys).toEqual(
      ['creating', 'createTag', 'updateTag', 'deleteTag', 'addTodoTag', 'removeTodoTag'].sort(),
    );
  });

  it('exposes creating as a boolean', () => {
    const { result } = renderHook(() => useTagMutations());
    expect(typeof result.current.creating).toBe('boolean');
  });

  it('exposes all mutation helpers as functions', () => {
    const { result } = renderHook(() => useTagMutations());
    const fns = ['createTag', 'updateTag', 'deleteTag', 'addTodoTag', 'removeTodoTag'] as const;
    fns.forEach((fn) => {
      expect(typeof result.current[fn]).toBe('function');
    });
  });

  it('createTag calls exec with name and color', async () => {
    const execs = setupMutationExecs(5);
    const { result } = renderHook(() => useTagMutations());

    await act(async () => {
      await result.current.createTag('Urgent', '#EF4444');
    });

    expect(execs[0]).toHaveBeenCalledWith({ name: 'Urgent', color: '#EF4444' });
  });

  it('addTodoTag calls exec with todoId and tagId', async () => {
    const execs = setupMutationExecs(5);
    const { result } = renderHook(() => useTagMutations());

    await act(async () => {
      await result.current.addTodoTag('todo-1', 'tag-9');
    });

    // addTodoTag is the 4th useMutation call (index 3)
    expect(execs[3]).toHaveBeenCalledWith({ todoId: 'todo-1', tagId: 'tag-9' });
  });

  it('removeTodoTag calls exec with todoId and tagId', async () => {
    const execs = setupMutationExecs(5);
    const { result } = renderHook(() => useTagMutations());

    await act(async () => {
      await result.current.removeTodoTag('todo-1', 'tag-9');
    });

    // removeTodoTag is the 5th useMutation call (index 4)
    expect(execs[4]).toHaveBeenCalledWith({ todoId: 'todo-1', tagId: 'tag-9' });
  });
});
