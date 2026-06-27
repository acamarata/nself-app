/**
 * Purpose: Domain types for ɳTask mobile — re-exported from @nself/ntask-core.
 * SPORT: P5-C-mobile — replaces old app_tasks/app_lists types.
 */

export type {
  NpTask,
  NpTaskSummary,
  NpList,
  NpSubtask,
  NpComment,
  NpTag,
  NpTodoTag,
  NpProfile,
  Priority,
  CreateTaskInput,
  UpdateTaskInput,
  CreateSubtaskInput,
  CreateCommentInput,
  CreateTagInput,
} from '@nself/ntask-core';

// Convenience alias — some components use TaskPriority
export type { Priority as TaskPriority } from '@nself/ntask-core';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  List: { listId: string; listTitle: string };
  TaskDetail: { taskId: string; listId: string };
};
