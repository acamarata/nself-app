/**
 * Purpose: GraphQL query/mutation strings for Hasura app_lists and app_tasks tables
 * Outputs: gql-tagged query/mutation constants mirroring Flutter BackendService
 * Constraints: Table names match nSelf schema: app_lists, app_tasks
 * SPORT: Direct port of BackendService list/task queries from backend_service.dart
 */

import { gql } from '@apollo/client';

export const GET_LISTS = gql`
  query GetLists {
    app_lists(order_by: { position: asc }) {
      id title description color position owner_id created_at updated_at
    }
  }
`;

export const CREATE_LIST = gql`
  mutation CreateList($title: String!, $color: String!) {
    insert_app_lists_one(object: { title: $title, color: $color, position: 0 }) {
      id title description color position owner_id created_at updated_at
    }
  }
`;

export const UPDATE_LIST = gql`
  mutation UpdateList($id: uuid!, $title: String, $color: String) {
    update_app_lists_by_pk(pk_columns: { id: $id }, _set: { title: $title, color: $color }) {
      id title description color position owner_id created_at updated_at
    }
  }
`;

export const DELETE_LIST = gql`
  mutation DeleteList($id: uuid!) {
    delete_app_lists_by_pk(id: $id) { id }
  }
`;

export const GET_TASKS = gql`
  query GetTasks($listId: uuid!) {
    app_tasks(where: { list_id: { _eq: $listId } }, order_by: { position: asc }) {
      id title description completed due_date list_id assignee_id position tags priority created_at updated_at
    }
  }
`;

export const CREATE_TASK = gql`
  mutation CreateTask($listId: uuid!, $title: String!) {
    insert_app_tasks_one(object: { list_id: $listId, title: $title, completed: false, position: 0 }) {
      id title description completed due_date list_id assignee_id position tags priority created_at updated_at
    }
  }
`;

export const TOGGLE_TASK = gql`
  mutation ToggleTask($id: uuid!, $completed: Boolean!) {
    update_app_tasks_by_pk(pk_columns: { id: $id }, _set: { completed: $completed }) { id }
  }
`;

export const UPDATE_TASK = gql`
  mutation UpdateTask(
    $id: uuid!
    $title: String
    $description: String
    $completed: Boolean
    $due_date: timestamptz
    $tags: jsonb
    $priority: String
  ) {
    update_app_tasks_by_pk(
      pk_columns: { id: $id }
      _set: {
        title: $title
        description: $description
        completed: $completed
        due_date: $due_date
        tags: $tags
        priority: $priority
      }
    ) {
      id title description completed due_date list_id assignee_id position tags priority created_at updated_at
    }
  }
`;

export const DELETE_TASK = gql`
  mutation DeleteTask($id: uuid!) {
    delete_app_tasks_by_pk(id: $id) { id }
  }
`;
