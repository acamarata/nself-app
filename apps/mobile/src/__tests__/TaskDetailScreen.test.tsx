/**
 * Purpose: Tests for TaskDetailScreen's offline queue integration — verifies that
 *   Save/Delete route through enqueue('update_task'/'delete_task') when offline
 *   instead of calling the urql mutation directly (previously a gap: only
 *   ListScreen's create/toggle/delete were offline-aware).
 * Inputs: Mocked urql (useQuery/useTaskMutations), useNetworkState, offline-queue.
 * Outputs: Asserts enqueue is called with expected type/payload when isConnected=false,
 *   and that the direct mutation is still used when isConnected=true.
 * SPORT: P5-C-mobile data layer rewire
 */

import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../theme';
import { TaskDetailScreen } from '../app/TaskDetailScreen';

const mockTask = {
  id: 'task-1',
  title: 'Test task',
  description: '',
  completed: false,
  priority: 'none' as const,
  notes: '',
  due_date: null,
  user_id: 'user-1',
};

jest.mock('urql', () => ({
  useQuery: () => [{ data: { np_todos_by_pk: mockTask }, fetching: false, error: undefined }, jest.fn()],
  // The screen mounts AttachmentList, whose hook calls useMutation. Without
  // this the whole tree throws "useMutation is not a function" and every test
  // in this file fails for a reason unrelated to what it asserts.
  useMutation: () => [{ fetching: false }, jest.fn().mockResolvedValue({ data: null, error: null })],
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn().mockResolvedValue({ canceled: true }),
}));

const mockUpdateTask = jest.fn().mockResolvedValue({});
const mockDeleteTask = jest.fn().mockResolvedValue({});
jest.mock('../hooks/useTaskMutations', () => ({
  useTaskMutations: () => ({ updateTask: mockUpdateTask, deleteTask: mockDeleteTask }),
}));

let mockIsConnected = true;
jest.mock('../hooks/useNetworkState', () => ({
  useNetworkState: () => ({ isConnected: mockIsConnected, isInternetReachable: true, wasOffline: false }),
}));

const mockEnqueue = jest.fn().mockResolvedValue(undefined);
jest.mock('../lib/offline-queue', () => ({
  enqueue: (...args: unknown[]) => mockEnqueue(...args),
}));

jest.mock('../components/AssigneeSelector', () => ({ AssigneeSelector: () => null }));
jest.mock('../components/SubtaskList', () => ({ SubtaskList: () => null }));
jest.mock('../components/CommentThread', () => ({ CommentThread: () => null }));
jest.mock('../components/TagPicker', () => ({ TagPicker: () => null }));

const mockNavigation = { goBack: jest.fn(), navigate: jest.fn() };

describe('TaskDetailScreen: offline queue integration', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsConnected = true;
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('calls updateTask directly when online', async () => {
    const { getByLabelText } = render(
      <ThemeProvider>
        <TaskDetailScreen navigation={mockNavigation as any} route={{ params: { taskId: 'task-1', listId: 'list-1' } } as any} />
      </ThemeProvider>,
    );
    fireEvent.press(getByLabelText('Save'));
    await waitFor(() => expect(mockUpdateTask).toHaveBeenCalled());
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('enqueues update_task instead of calling updateTask when offline', async () => {
    mockIsConnected = false;
    const { getByLabelText } = render(
      <ThemeProvider>
        <TaskDetailScreen navigation={mockNavigation as any} route={{ params: { taskId: 'task-1', listId: 'list-1' } } as any} />
      </ThemeProvider>,
    );
    fireEvent.press(getByLabelText('Save'));
    await waitFor(() => expect(mockEnqueue).toHaveBeenCalledWith(
      'update_task',
      expect.objectContaining({ id: 'task-1', fields: expect.any(Object) }),
      expect.any(String),
    ));
    expect(mockUpdateTask).not.toHaveBeenCalled();
  });

  it('enqueues delete_task instead of calling deleteTask when offline', async () => {
    mockIsConnected = false;
    const { getByLabelText } = render(
      <ThemeProvider>
        <TaskDetailScreen navigation={mockNavigation as any} route={{ params: { taskId: 'task-1', listId: 'list-1' } } as any} />
      </ThemeProvider>,
    );
    fireEvent.press(getByLabelText('Delete task'));
    // Alert.alert is native — simulate pressing "Delete" via the spied call args
    const alertCall = alertSpy.mock.calls[0];
    const deleteButton = alertCall[2].find((b: { text: string }) => b.text === 'Delete');
    await deleteButton.onPress();
    expect(mockEnqueue).toHaveBeenCalledWith(
      'delete_task',
      { id: 'task-1' },
      expect.any(String),
    );
    expect(mockDeleteTask).not.toHaveBeenCalled();
  });
});
