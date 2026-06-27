/**
 * Purpose: Re-export GraphQL operations from @nself/ntask-core for the mobile app.
 * All queries/mutations target np_* tables (post-Epic-A schema).
 * SPORT: P5-C-mobile data layer rewire.
 */
export {
  GET_LISTS,
  CREATE_LIST,
  UPDATE_LIST,
  DELETE_LIST,
} from '@nself/ntask-core';

export {
  GET_LIST_TODOS,
  GET_TODO,
  SEARCH_TODOS,
  CREATE_TODO,
  UPDATE_TODO,
  TOGGLE_TODO,
  DELETE_TODO,
} from '@nself/ntask-core';

export {
  GET_SUBTASKS,
  CREATE_SUBTASK,
  UPDATE_SUBTASK,
  TOGGLE_SUBTASK,
  DELETE_SUBTASK,
} from '@nself/ntask-core';

export {
  GET_COMMENTS,
  CREATE_COMMENT,
  UPDATE_COMMENT,
  DELETE_COMMENT,
} from '@nself/ntask-core';

export {
  GET_TAGS,
  CREATE_TAG,
  UPDATE_TAG,
  DELETE_TAG,
  ADD_TODO_TAG,
  REMOVE_TODO_TAG,
} from '@nself/ntask-core';

export { GET_PROFILE } from '@nself/ntask-core';

// Collab + Account ops are defined inline in lib/collabOps.ts and lib/accountOps.ts.
// They are imported directly by their respective hooks and screens.
// They will be upstreamed to @nself/ntask-core in a future phase.
