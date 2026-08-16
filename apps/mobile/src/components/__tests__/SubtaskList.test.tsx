/**
 * Purpose: SubtaskList renders without crash and routes create/toggle/delete
 *   through the offline queue when isOffline=true (FIX 4 — subtasks previously
 *   had no offline-queue coverage and just failed silently offline).
 * SPORT: P5-C-mobile.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';

const SAMPLE_SUBTASK = { id: 'sub-1', title: 'Buy milk', is_done: false };

let mockQueryData: { np_subtasks: typeof SAMPLE_SUBTASK[] } = { np_subtasks: [] };
jest.mock('urql', () => ({
  useQuery: () => [{ data: mockQueryData, fetching: false, error: null }, jest.fn()],
  useMutation: () => [{ fetching: false }, jest.fn()],
}));

// Wrapped in arrows so these resolve at call-time, not factory-creation-time —
// see usePushToken.test.ts for the full explanation of this jest.mock hoisting gotcha.
const mockCreateSubtask = jest.fn().mockResolvedValue({});
const mockToggleSubtask = jest.fn().mockResolvedValue({});
const mockDeleteSubtask = jest.fn().mockResolvedValue({});
jest.mock('../../hooks/useTaskMutations', () => ({
  useSubtaskMutations: () => ({
    createSubtask: (...args: unknown[]) => mockCreateSubtask(...args),
    toggleSubtask: (...args: unknown[]) => mockToggleSubtask(...args),
    deleteSubtask: (...args: unknown[]) => mockDeleteSubtask(...args),
    creating: false,
  }),
}));

const mockEnqueue = jest.fn().mockResolvedValue(undefined);
jest.mock('../../lib/offline-queue', () => ({
  enqueue: (...args: unknown[]) => mockEnqueue(...args),
}));

jest.mock('../../lib/idempotency', () => ({
  generateIdempotencyKey: jest.fn(() => 'idem-key-test'),
}));

import { SubtaskList } from '../SubtaskList';

function renderSubtaskList(isOffline: boolean) {
  return render(
    <ThemeProvider>
      <SubtaskList todoId="test-id" isOffline={isOffline} />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateSubtask.mockResolvedValue({});
  mockToggleSubtask.mockResolvedValue({});
  mockDeleteSubtask.mockResolvedValue({});
  mockEnqueue.mockResolvedValue(undefined);
  mockQueryData = { np_subtasks: [] };
});

describe('SubtaskList', () => {
  it('renders empty state', () => {
    const { getByText } = renderSubtaskList(false);
    expect(getByText('No subtasks yet.')).toBeTruthy();
  });

  describe('online', () => {
    it('calls createSubtask directly when adding', async () => {
      const { getByLabelText } = renderSubtaskList(false);
      fireEvent.press(getByLabelText('Add subtask'));
      fireEvent.changeText(getByLabelText('New subtask title'), 'Buy milk');
      fireEvent.press(getByLabelText('Save subtask'));
      await waitFor(() => expect(mockCreateSubtask).toHaveBeenCalledWith('test-id', 'Buy milk', 0));
      expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it('calls toggleSubtask directly when checking a subtask', async () => {
      mockQueryData = { np_subtasks: [SAMPLE_SUBTASK] };
      const { getByLabelText } = renderSubtaskList(false);
      fireEvent.press(getByLabelText('Buy milk'));
      await waitFor(() => expect(mockToggleSubtask).toHaveBeenCalledWith('sub-1', true));
      expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it('calls deleteSubtask directly when deleting', async () => {
      mockQueryData = { np_subtasks: [SAMPLE_SUBTASK] };
      const { getByLabelText } = renderSubtaskList(false);
      fireEvent.press(getByLabelText('Delete subtask Buy milk'));
      await waitFor(() => expect(mockDeleteSubtask).toHaveBeenCalledWith('sub-1'));
      expect(mockEnqueue).not.toHaveBeenCalled();
    });
  });

  describe('offline (FIX 4)', () => {
    it('enqueues create_subtask instead of calling createSubtask', async () => {
      const { getByLabelText } = renderSubtaskList(true);
      fireEvent.press(getByLabelText('Add subtask'));
      fireEvent.changeText(getByLabelText('New subtask title'), 'Buy milk');
      fireEvent.press(getByLabelText('Save subtask'));
      await waitFor(() =>
        expect(mockEnqueue).toHaveBeenCalledWith(
          'create_subtask',
          expect.objectContaining({ todoId: 'test-id', title: 'Buy milk' }),
          expect.any(String),
        ),
      );
      expect(mockCreateSubtask).not.toHaveBeenCalled();
    });

    it('enqueues toggle_subtask instead of calling toggleSubtask', async () => {
      mockQueryData = { np_subtasks: [SAMPLE_SUBTASK] };
      const { getByLabelText } = renderSubtaskList(true);
      fireEvent.press(getByLabelText('Buy milk'));
      await waitFor(() =>
        expect(mockEnqueue).toHaveBeenCalledWith(
          'toggle_subtask',
          { id: 'sub-1', isDone: true },
          expect.any(String),
        ),
      );
      expect(mockToggleSubtask).not.toHaveBeenCalled();
    });

    it('enqueues delete_subtask instead of calling deleteSubtask', async () => {
      mockQueryData = { np_subtasks: [SAMPLE_SUBTASK] };
      const { getByLabelText } = renderSubtaskList(true);
      fireEvent.press(getByLabelText('Delete subtask Buy milk'));
      await waitFor(() =>
        expect(mockEnqueue).toHaveBeenCalledWith('delete_subtask', { id: 'sub-1' }, expect.any(String)),
      );
      expect(mockDeleteSubtask).not.toHaveBeenCalled();
    });
  });
});
