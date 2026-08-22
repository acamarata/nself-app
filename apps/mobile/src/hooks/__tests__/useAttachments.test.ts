/**
 * Purpose: Cover the three-step upload contract in useAttachments.
 *
 * Every step here has been broken in production at some point:
 *   - presign returned "internal error" for an unrelated reason
 *   - the presigned URL pointed at a host the client could not reach
 *   - the row insert used column names the schema does not have
 *
 * A silent failure at any step looks like a successful upload with no
 * attachment, so each one is asserted separately.
 * SPORT: P5-C-mobile — attachments.
 */

const mockUploadUrl = jest.fn();
const mockDownloadUrl = jest.fn();
const mockCreate = jest.fn();
const mockDelete = jest.fn();

// Dispatch on the operation text rather than call order. A positional
// mockImplementationOnce chain runs out as soon as the hook re-renders, which
// makes every test fail with "Invalid attempt to destructure non-iterable".
jest.mock('urql', () => ({
  useMutation: (op: string) => {
    if (op.includes('getUploadUrl')) return [{}, (...a: unknown[]) => mockUploadUrl(...a)];
    if (op.includes('getDownloadUrl')) return [{}, (...a: unknown[]) => mockDownloadUrl(...a)];
    if (op.includes('insert_np_attachments_one')) return [{}, (...a: unknown[]) => mockCreate(...a)];
    if (op.includes('delete_np_attachments_by_pk')) return [{}, (...a: unknown[]) => mockDelete(...a)];
    throw new Error(`unexpected operation in test: ${String(op).slice(0, 80)}`);
  },
}));

import { renderHook, act } from '@testing-library/react-native';
import { MAX_ATTACHMENT_BYTES } from '@nself/ntask-core';
import { useAttachments } from '../useAttachments';

const FILE = { uri: 'file:///tmp/a.pdf', name: 'a.pdf', mimeType: 'application/pdf', size: 10 };
const GRANT = {
  uploadUrl: 'https://storage.example.test/ntask/attachments/u/t/uuid-a.pdf?X-Amz-Signature=abc',
  storagePath: 'attachments/u/t/uuid-a.pdf',
  expiresAt: '2026-01-01T00:15:00Z',
};

function mockFetchSequence(putOk = true) {
  const fetchMock = jest.fn()
    // first call: read the local file into a blob
    .mockResolvedValueOnce({ blob: async () => 'BYTES' })
    // second call: the presigned PUT
    .mockResolvedValueOnce({ ok: putOk });
  (global as unknown as { fetch: unknown }).fetch = fetchMock;
  return fetchMock;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUploadUrl.mockResolvedValue({ data: { getUploadUrl: GRANT }, error: null });
  mockCreate.mockResolvedValue({ data: {}, error: null });
});

describe('useAttachments.upload', () => {
  it('runs all three steps and reports success', async () => {
    const fetchMock = mockFetchSequence();
    const { result } = renderHook(() => useAttachments('todo-1'));

    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.upload(FILE); });

    expect(ok).toBe(true);
    expect(mockUploadUrl).toHaveBeenCalledWith({
      fileName: 'a.pdf', mimeType: 'application/pdf', todoId: 'todo-1',
    });
    // Step 3 must persist the path the SERVER chose, not a client-built one.
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      storageKey: GRANT.storagePath, todoId: 'todo-1', fileSizeBytes: 10,
    }));
    // bucket/uploader_id are server-controlled and must never be sent.
    const sent = mockCreate.mock.calls[0][0];
    expect(sent).not.toHaveProperty('bucket');
    expect(sent).not.toHaveProperty('uploaderId');
  });

  it('PUTs to the presigned URL with no Authorization header', async () => {
    const fetchMock = mockFetchSequence();
    const { result } = renderHook(() => useAttachments('todo-1'));
    await act(async () => { await result.current.upload(FILE); });

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(GRANT.uploadUrl);
    expect(init.method).toBe('PUT');
    // The query-string signature IS the authorisation; an Authorization header
    // invalidates it.
    expect(Object.keys(init.headers)).not.toContain('Authorization');
  });

  it('rejects an oversized file before spending bandwidth on it', async () => {
    const fetchMock = mockFetchSequence();
    const { result } = renderHook(() => useAttachments('todo-1'));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.upload({ ...FILE, size: MAX_ATTACHMENT_BYTES + 1 });
    });

    expect(ok).toBe(false);
    expect(result.current.error).toBe('too-large');
    expect(mockUploadUrl).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not record a row when the presign fails', async () => {
    mockUploadUrl.mockResolvedValue({ data: null, error: new Error('nope') });
    const { result } = renderHook(() => useAttachments('todo-1'));

    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.upload(FILE); });

    expect(ok).toBe(false);
    expect(result.current.error).toBe('presign-failed');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('does not record a row when the PUT fails', async () => {
    mockFetchSequence(false);
    const { result } = renderHook(() => useAttachments('todo-1'));

    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.upload(FILE); });

    expect(ok).toBe(false);
    expect(result.current.error).toBe('upload-failed');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('reports a distinct error when the bytes land but the row does not', async () => {
    mockFetchSequence();
    mockCreate.mockResolvedValue({ data: null, error: new Error('permission') });
    const { result } = renderHook(() => useAttachments('todo-1'));

    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.upload(FILE); });

    expect(ok).toBe(false);
    // Distinct from upload-failed: the object now exists but nothing references
    // it, which is the orphan case worth telling the user about.
    expect(result.current.error).toBe('record-failed');
  });
});

describe('useAttachments.getDownloadUrl / remove', () => {
  it('returns a freshly signed URL', async () => {
    mockDownloadUrl.mockResolvedValue({ data: { getDownloadUrl: { downloadUrl: 'https://x/y' } }, error: null });
    const { result } = renderHook(() => useAttachments('todo-1'));

    let url: string | null = null;
    await act(async () => { url = await result.current.getDownloadUrl('att-1'); });

    expect(url).toBe('https://x/y');
    expect(mockDownloadUrl).toHaveBeenCalledWith({ attachmentId: 'att-1' });
  });

  it('surfaces a download failure rather than returning a broken URL', async () => {
    mockDownloadUrl.mockResolvedValue({ data: null, error: new Error('denied') });
    const { result } = renderHook(() => useAttachments('todo-1'));

    let url: string | null = 'unset';
    await act(async () => { url = await result.current.getDownloadUrl('att-1'); });

    expect(url).toBeNull();
    expect(result.current.error).toBe('download-failed');
  });

  it('deletes by id', async () => {
    mockDelete.mockResolvedValue({ data: {}, error: null });
    const { result } = renderHook(() => useAttachments('todo-1'));

    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.remove('att-1'); });

    expect(ok).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith({ id: 'att-1' });
  });
});
