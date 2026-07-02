/**
 * GraphQL operation strings consumed by the ɳTask CLI and MCP server.
 *
 * Purpose:    Minimal, dependency-free copies of the operations needed for
 *             CLI/agent task management (list/add/complete/search/update).
 * Inputs:     None (static query/mutation strings, tagged with GraphQL for
 *             editor syntax highlighting only — not executed via codegen).
 * Outputs:    Exported `gql`-tagged template strings, one per operation.
 * Constraints: These mirror (and must stay compatible with) the canonical
 *             operations in
 *             web/packages/@nself/ntask-core/src/operations/{tasks,lists,tags}.ts.
 *             Do not diverge on field names/shapes without updating both.
 *             Tables: np_todos, np_lists, np_tags, np_todo_tags (source_account_id
 *             multi-app isolation column present on every row per ASI Multi-Tenant
 *             Convention Wall — never confuse with tenant_id).
 * SPORT:      cli/ + mcp/ shared GQL layer (not itself a SPORT-tracked entity;
 *             mirrors ntask-core operations which are).
 */

export const GET_LISTS = /* GraphQL */ `
  query GetLists {
    np_lists(order_by: { position: asc, created_at: asc }) {
      id
      title
      description
      color
      icon
      is_default
      position
      group_id
      created_at
      updated_at
    }
  }
`;

export const GET_LIST_TODOS = /* GraphQL */ `
  query GetListTodos($listId: uuid!) {
    np_todos(
      where: { list_id: { _eq: $listId } }
      order_by: { position: asc, created_at: asc }
    ) {
      id
      list_id
      title
      description
      completed
      priority
      notes
      due_date
      position
      created_at
      updated_at
    }
  }
`;

// NOTE: Hasura rejects an explicit `null` bound to a scalar comparator
// (e.g. `{ _eq: $completed }` with `$completed` omitted) even though the
// variable itself is nullable — "unexpected null value for type 'Boolean'".
// Instead, take the whole `where` clause as a variable so the caller can
// pass `{}` (no filter) or `{ completed: { _eq: true } }` (filtered).
export const GET_ALL_TODOS = /* GraphQL */ `
  query GetAllTodos($where: np_todos_bool_exp) {
    np_todos(
      where: $where
      order_by: { due_date: asc, position: asc, created_at: asc }
    ) {
      id
      list_id
      title
      description
      completed
      priority
      notes
      due_date
      position
      created_at
      updated_at
    }
  }
`;

export const GET_TODOS_DUE_BETWEEN = /* GraphQL */ `
  query GetTodosDueBetween($start: timestamptz!, $end: timestamptz!) {
    np_todos(
      where: {
        completed: { _eq: false }
        due_date: { _gte: $start, _lte: $end }
      }
      order_by: { due_date: asc, position: asc }
    ) {
      id
      list_id
      title
      completed
      priority
      due_date
      position
    }
  }
`;

export const GET_TODOS_DUE_BEFORE = /* GraphQL */ `
  query GetTodosDueBefore($end: timestamptz!) {
    np_todos(
      where: { completed: { _eq: false }, due_date: { _lte: $end } }
      order_by: { due_date: asc, position: asc }
    ) {
      id
      list_id
      title
      completed
      priority
      due_date
      position
    }
  }
`;

export const SEARCH_TODOS = /* GraphQL */ `
  query SearchTodos($q: String!, $limit: Int) {
    np_todos(
      where: { title: { _ilike: $q } }
      limit: $limit
      order_by: { updated_at: desc }
    ) {
      id
      title
      completed
      priority
      due_date
      list_id
    }
  }
`;

export const GET_TODO = /* GraphQL */ `
  query GetTodo($id: uuid!) {
    np_todos_by_pk(id: $id) {
      id
      list_id
      title
      description
      completed
      priority
      notes
      due_date
      position
      created_at
      updated_at
    }
  }
`;

export const CREATE_TODO = /* GraphQL */ `
  mutation CreateTodo(
    $listId: uuid!
    $title: String!
    $priority: String
    $description: String
    $notes: String
    $dueDate: timestamptz
    $position: Int
  ) {
    insert_np_todos_one(
      object: {
        list_id: $listId
        title: $title
        priority: $priority
        description: $description
        notes: $notes
        due_date: $dueDate
        position: $position
      }
    ) {
      id
      list_id
      title
      completed
      priority
      due_date
      position
      created_at
      updated_at
    }
  }
`;

export const UPDATE_TODO = /* GraphQL */ `
  mutation UpdateTodo(
    $id: uuid!
    $title: String
    $description: String
    $completed: Boolean
    $priority: String
    $notes: String
    $dueDate: timestamptz
    $position: Int
  ) {
    update_np_todos_by_pk(
      pk_columns: { id: $id }
      _set: {
        title: $title
        description: $description
        completed: $completed
        priority: $priority
        notes: $notes
        due_date: $dueDate
        position: $position
      }
    ) {
      id
      title
      description
      completed
      priority
      notes
      due_date
      position
      updated_at
    }
  }
`;

export const TOGGLE_TODO = /* GraphQL */ `
  mutation ToggleTodo($id: uuid!, $completed: Boolean!) {
    update_np_todos_by_pk(pk_columns: { id: $id }, _set: { completed: $completed }) {
      id
      title
      completed
      updated_at
    }
  }
`;

export const DELETE_TODO = /* GraphQL */ `
  mutation DeleteTodo($id: uuid!) {
    delete_np_todos_by_pk(id: $id) {
      id
      title
    }
  }
`;

export const CREATE_LIST = /* GraphQL */ `
  mutation CreateList(
    $title: String!
    $color: String
    $icon: String
    $description: String
    $position: Int
  ) {
    insert_np_lists_one(
      object: {
        title: $title
        color: $color
        icon: $icon
        description: $description
        position: $position
      }
    ) {
      id
      title
      description
      color
      icon
      is_default
      position
      created_at
      updated_at
    }
  }
`;
