/**
 * Purpose: Shared TypeScript types for task management domain
 * Outputs: Task, TaskList, TaskPriority types matching Hasura GraphQL schema
 * SPORT: Mirrors Flutter Task + TaskList models from app/lib/models/
 */

export type TaskPriority = 'none' | 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  completed: boolean;
  due_date?: string | null;
  list_id: string;
  assignee_id?: string | null;
  position: number;
  tags: string[];
  priority: TaskPriority;
  created_at: string;
  updated_at: string;
}

export interface TaskList {
  id: string;
  title: string;
  description?: string | null;
  color: string;
  position: number;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  List: { listId: string; listTitle: string };
  TaskDetail: { task: Task; listId: string };
};
