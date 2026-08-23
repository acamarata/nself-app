/**
 * Purpose: AssigneeSelector reflects np_todo_assignees (many-to-many), toggles
 *   membership, and hides itself on a personal list.
 *
 * The previous version took a single `assigneeId` and was mounted with a
 * hardcoded `null` + `readonly`, so it could never show or change an assignee.
 * These assert the behaviours that were impossible before.
 * SPORT: P5-C-mobile — assignees.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';

const ME = 'user-me';
const OTHER = 'user-other';

interface TestMember {
  id: string;
  user_id: string;
  role: string;
  // Nullable on purpose: np_member_profiles has no row for a member who never
  // set a display name, and the component must fall back rather than crash.
  profile: { display_name: string | null; avatar_url: string | null } | null;
}

const MEMBERS: TestMember[] = [
  { id: 'm1', user_id: ME, role: 'owner', profile: { display_name: 'Ada', avatar_url: null } },
  { id: 'm2', user_id: OTHER, role: 'editor', profile: { display_name: 'Grace', avatar_url: null } },
];

let mockMembers: TestMember[] = [];
let mockAssignees: Array<{ id: string; assignee_id: string }> = [];
const mockRefetch = jest.fn();

// Dispatch on the operation text, not call order: a positional mock chain runs
// out on re-render and every test then fails on a destructure.
jest.mock('urql', () => ({
  // collabOps.ts builds its operations with urql's gql template tag, so the
  // mock must provide it or importing the component throws before any test runs.
  gql: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ''), ''),
  useQuery: ({ query }: { query: string }) => {
    if (String(query).includes('np_list_members')) {
      return [{ data: { np_list_members: mockMembers }, fetching: false, error: null }, jest.fn()];
    }
    return [
      { data: { np_todo_assignees: mockAssignees }, fetching: false, error: null },
      (...a: unknown[]) => mockRefetch(...a),
    ];
  },
  useMutation: (op: string) => {
    if (String(op).includes('insert_np_todo_assignees_one')) {
      return [{}, (...a: unknown[]) => mockAssign(...a)];
    }
    return [{}, (...a: unknown[]) => mockUnassign(...a)];
  },
}));

const mockAssign = jest.fn().mockResolvedValue({ data: {}, error: null });
const mockUnassign = jest.fn().mockResolvedValue({ data: {}, error: null });

import { AssigneeSelector } from '../AssigneeSelector';

function renderSel(listId: string | null = 'list-1') {
  return render(
    <ThemeProvider>
      <AssigneeSelector todoId="todo-1" listId={listId} />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockMembers = MEMBERS;
  mockAssignees = [];
});

describe('AssigneeSelector', () => {
  it('renders nothing on a personal list with no members', () => {
    mockMembers = [];
    const { toJSON } = renderSel();
    expect(toJSON()).toBeNull();
  });

  it('renders nothing when the task has no list', () => {
    const { toJSON } = renderSel(null);
    expect(toJSON()).toBeNull();
  });

  it('shows Unassigned when nobody is assigned', () => {
    const { getByText } = renderSel();
    expect(getByText('Unassigned')).toBeTruthy();
  });

  it('shows a chip per assignee, using the member display name', () => {
    mockAssignees = [{ id: 'a1', assignee_id: OTHER }];
    const { getByLabelText, queryByText } = renderSel();
    expect(getByLabelText('Assigned: Grace')).toBeTruthy();
    expect(queryByText('Unassigned')).toBeNull();
  });

  it('supports multiple assignees — the schema is many-to-many', () => {
    mockAssignees = [{ id: 'a1', assignee_id: ME }, { id: 'a2', assignee_id: OTHER }];
    const { getByLabelText } = renderSel();
    expect(getByLabelText('Assigned: Ada')).toBeTruthy();
    expect(getByLabelText('Assigned: Grace')).toBeTruthy();
  });

  it('assigns an unassigned member when toggled', async () => {
    const { getByLabelText } = renderSel();
    fireEvent.press(getByLabelText('Assign a member'));
    fireEvent.press(getByLabelText('Grace'));
    await waitFor(() =>
      expect(mockAssign).toHaveBeenCalledWith({ todoId: 'todo-1', assigneeId: OTHER }),
    );
    expect(mockUnassign).not.toHaveBeenCalled();
  });

  it('unassigns an already-assigned member when toggled', async () => {
    mockAssignees = [{ id: 'a1', assignee_id: OTHER }];
    const { getByLabelText } = renderSel();
    fireEvent.press(getByLabelText('Assign a member'));
    fireEvent.press(getByLabelText('Grace'));
    await waitFor(() =>
      expect(mockUnassign).toHaveBeenCalledWith({ todoId: 'todo-1', assigneeId: OTHER }),
    );
    expect(mockAssign).not.toHaveBeenCalled();
  });

  it('refetches after a successful change rather than patching local state', async () => {
    const { getByLabelText } = renderSel();
    fireEvent.press(getByLabelText('Assign a member'));
    fireEvent.press(getByLabelText('Grace'));
    await waitFor(() => expect(mockRefetch).toHaveBeenCalled());
  });

  it('does not refetch when the server rejects the change', async () => {
    // Insufficient share permission is enforced server-side; the list must keep
    // showing what the server actually stored, not an optimistic lie.
    mockAssign.mockResolvedValueOnce({ data: null, error: new Error('permission') });
    const { getByLabelText } = renderSel();
    fireEvent.press(getByLabelText('Assign a member'));
    fireEvent.press(getByLabelText('Grace'));
    await waitFor(() => expect(mockAssign).toHaveBeenCalled());
    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it('falls back to a truncated id when a member has no display name', () => {
    mockMembers = [{ id: 'm3', user_id: 'abcdef123456', role: 'editor', profile: null }];
    mockAssignees = [{ id: 'a1', assignee_id: 'abcdef123456' }];
    const { getByLabelText } = renderSel();
    expect(getByLabelText('Assigned: User …123456')).toBeTruthy();
  });
});
