/**
 * Purpose: CommentThread renders and routes create/delete comment through the
 *   offline queue when isOffline=true (FIX 4 — comments previously had no
 *   offline-queue coverage and just failed silently offline).
 * SPORT: P5-C-mobile.
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';

const SAMPLE_COMMENT = {
  id: 'comment-1',
  body: 'Looks good',
  author_id: 'other-user',
  created_at: '2026-01-01T00:00:00Z',
  edited_at: null,
};

let mockQueryData: { np_comments: typeof SAMPLE_COMMENT[] } = { np_comments: [] };
jest.mock('urql', () => ({
  useQuery: () => [{ data: mockQueryData, fetching: false, error: null }, jest.fn()],
  useMutation: () => [{ fetching: false }, jest.fn()],
}));

// Wrapped in arrows so these resolve at call-time, not factory-creation-time —
// see usePushToken.test.ts for the full explanation of this jest.mock hoisting gotcha.
const mockCreateComment = jest.fn().mockResolvedValue({});
const mockDeleteComment = jest.fn().mockResolvedValue({});
jest.mock('../../hooks/useTaskMutations', () => ({
  useCommentMutations: () => ({
    createComment: (...args: unknown[]) => mockCreateComment(...args),
    deleteComment: (...args: unknown[]) => mockDeleteComment(...args),
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

import { CommentThread } from '../CommentThread';

function renderCommentThread(isOffline: boolean) {
  return render(
    <ThemeProvider>
      <CommentThread todoId="task-1" userId="me" isOffline={isOffline} />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateComment.mockResolvedValue({});
  mockDeleteComment.mockResolvedValue({});
  mockEnqueue.mockResolvedValue(undefined);
  mockQueryData = { np_comments: [] };
});

describe('CommentThread', () => {
  it('renders empty state', () => {
    const { getByText } = renderCommentThread(false);
    expect(getByText('No comments yet.')).toBeTruthy();
  });

  describe('online', () => {
    it('calls createComment directly when sending', async () => {
      const { getByLabelText } = renderCommentThread(false);
      fireEvent.changeText(getByLabelText('Comment text'), 'Looks good');
      fireEvent.press(getByLabelText('Send comment'));
      await waitFor(() => expect(mockCreateComment).toHaveBeenCalledWith('task-1', 'Looks good', 'idem-key-test'));
      expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it('calls deleteComment directly when confirming delete', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      mockQueryData = { np_comments: [{ ...SAMPLE_COMMENT, author_id: 'me' }] };
      const { getByLabelText } = renderCommentThread(false);
      fireEvent(getByLabelText('Comment: Looks good'), 'longPress');
      const buttons = alertSpy.mock.calls[0][2] as Array<{ text: string; onPress?: () => Promise<void> }>;
      await buttons.find((b) => b.text === 'Delete')!.onPress!();
      expect(mockDeleteComment).toHaveBeenCalledWith('comment-1');
      expect(mockEnqueue).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });
  });

  describe('offline (FIX 4)', () => {
    it('enqueues create_comment instead of calling createComment', async () => {
      const { getByLabelText } = renderCommentThread(true);
      fireEvent.changeText(getByLabelText('Comment text'), 'Looks good');
      fireEvent.press(getByLabelText('Send comment'));
      await waitFor(() =>
        expect(mockEnqueue).toHaveBeenCalledWith(
          'create_comment',
          { todoId: 'task-1', body: 'Looks good' },
          'idem-key-test',
        ),
      );
      expect(mockCreateComment).not.toHaveBeenCalled();
    });

    it('enqueues delete_comment instead of calling deleteComment', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      mockQueryData = { np_comments: [{ ...SAMPLE_COMMENT, author_id: 'me' }] };
      const { getByLabelText } = renderCommentThread(true);
      fireEvent(getByLabelText('Comment: Looks good'), 'longPress');
      const buttons = alertSpy.mock.calls[0][2] as Array<{ text: string; onPress?: () => Promise<void> }>;
      await buttons.find((b) => b.text === 'Delete')!.onPress!();
      expect(mockEnqueue).toHaveBeenCalledWith('delete_comment', { id: 'comment-1' }, expect.any(String));
      expect(mockDeleteComment).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });
  });
});
