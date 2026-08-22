/**
 * Purpose: AttachmentList renders the 7-state pattern, gates delete to the
 *   uploader, and disables uploads while offline (a presigned URL expires in
 *   15 minutes, so an upload cannot be queued the way a comment can).
 * SPORT: P5-C-mobile — attachments.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';

const MINE = 'user-me';

const OWN_FILE = {
  id: 'att-1',
  todo_id: 'todo-1',
  uploader_id: MINE,
  storage_key: `attachments/${MINE}/todo-1/uuid-report.pdf`,
  bucket: 'ntask',
  file_name: 'report.pdf',
  mime_type: 'application/pdf',
  file_size_bytes: 2048,
  created_at: '2026-01-01T00:00:00Z',
};

const SOMEONE_ELSES = { ...OWN_FILE, id: 'att-2', uploader_id: 'other-user', file_name: 'theirs.pdf' };

let mockQueryData: { np_attachments: (typeof OWN_FILE)[] } | undefined = { np_attachments: [] };
let mockFetching = false;
let mockError: unknown = null;
const mockReexecute = jest.fn();

jest.mock('urql', () => ({
  useQuery: () => [
    { data: mockQueryData, fetching: mockFetching, error: mockError },
    (...args: unknown[]) => mockReexecute(...args),
  ],
  useMutation: () => [{ fetching: false }, jest.fn()],
}));

// Arrow-wrapped so they resolve at call time rather than at factory-creation
// time — the jest.mock hoisting gotcha documented in usePushToken.test.ts.
const mockUpload = jest.fn().mockResolvedValue(true);
const mockGetDownloadUrl = jest.fn().mockResolvedValue('https://example.test/signed');
const mockRemove = jest.fn().mockResolvedValue(true);
let mockUploading = false;
jest.mock('../../hooks/useAttachments', () => ({
  useAttachments: () => ({
    upload: (...a: unknown[]) => mockUpload(...a),
    getDownloadUrl: (...a: unknown[]) => mockGetDownloadUrl(...a),
    remove: (...a: unknown[]) => mockRemove(...a),
    uploading: mockUploading,
    error: null,
  }),
}));

const mockPick = jest.fn();
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...a: unknown[]) => mockPick(...a),
}));

import { Linking } from 'react-native';
import { AttachmentList } from '../AttachmentList';

// Spying on the real module rather than jest.mock'ing an internal RN path:
// the component imports Linking from 'react-native', and mocking
// react-native/Libraries/Linking/Linking does not intercept that import.
const mockOpenURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

function renderList(props: Partial<React.ComponentProps<typeof AttachmentList>> = {}) {
  return render(
    <ThemeProvider>
      <AttachmentList todoId="todo-1" userId={MINE} isOffline={false} {...props} />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockQueryData = { np_attachments: [] };
  mockFetching = false;
  mockError = null;
  mockUploading = false;
});

describe('AttachmentList', () => {
  it('shows the empty state when there are no files', () => {
    const { getByText } = renderList();
    expect(getByText('No files yet.')).toBeTruthy();
  });

  it('shows the error state when the query fails', () => {
    mockError = new Error('boom');
    mockQueryData = { np_attachments: [] };
    const { getByText } = renderList();
    expect(getByText('Could not load files.')).toBeTruthy();
  });

  it('renders a file with a human-readable size', () => {
    mockQueryData = { np_attachments: [OWN_FILE] };
    const { getByText } = renderList();
    expect(getByText('report.pdf')).toBeTruthy();
    expect(getByText('2 KB')).toBeTruthy();
  });

  it('offers Remove for your own file', () => {
    mockQueryData = { np_attachments: [OWN_FILE] };
    const { getByLabelText } = renderList();
    expect(getByLabelText('Remove report.pdf')).toBeTruthy();
  });

  it('does not offer Remove for someone else uploaded file', () => {
    mockQueryData = { np_attachments: [SOMEONE_ELSES] };
    const { queryByLabelText } = renderList();
    expect(queryByLabelText('Remove theirs.pdf')).toBeNull();
  });

  it('opens a file through a freshly presigned URL, never a stored one', async () => {
    mockQueryData = { np_attachments: [OWN_FILE] };
    const { getByLabelText } = renderList();
    fireEvent.press(getByLabelText('Open report.pdf'));
    await waitFor(() => expect(mockGetDownloadUrl).toHaveBeenCalledWith('att-1'));
    await waitFor(() => expect(mockOpenURL).toHaveBeenCalledWith('https://example.test/signed'));
  });

  it('disables adding while offline', () => {
    const { getByLabelText, getByText } = renderList({ isOffline: true });
    expect(getByLabelText('Add file').props.accessibilityState.disabled).toBe(true);
    expect(getByText('Add file (offline)')).toBeTruthy();
  });

  it('uploads the picked file and refetches', async () => {
    mockPick.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/a.pdf', name: 'a.pdf', mimeType: 'application/pdf', size: 10 }],
    });
    const { getByLabelText } = renderList();
    fireEvent.press(getByLabelText('Add file'));
    await waitFor(() =>
      expect(mockUpload).toHaveBeenCalledWith({
        uri: 'file:///tmp/a.pdf',
        name: 'a.pdf',
        mimeType: 'application/pdf',
        size: 10,
      }),
    );
    await waitFor(() => expect(mockReexecute).toHaveBeenCalled());
  });

  it('does nothing when the picker is cancelled', async () => {
    mockPick.mockResolvedValue({ canceled: true });
    const { getByLabelText } = renderList();
    fireEvent.press(getByLabelText('Add file'));
    await waitFor(() => expect(mockPick).toHaveBeenCalled());
    expect(mockUpload).not.toHaveBeenCalled();
  });
});
