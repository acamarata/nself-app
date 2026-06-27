/**
 * Tests deep link URL parsing for ntask:// scheme.
 * Navigation integration is tested via E2E (Detox).
 */

// Pure utility functions for deep link parsing — no RN dep
function parseDeepLink(url: string): { screen: string; params: Record<string, string> } | null {
  try {
    const withoutScheme = url.replace('ntask://', '');
    const [path, queryString] = withoutScheme.split('?');
    const segments = (path ?? '').split('/').filter(Boolean);
    const params: Record<string, string> = {};
    if (queryString) {
      queryString.split('&').forEach((pair) => {
        const [k, v] = pair.split('=');
        if (k && v) params[decodeURIComponent(k)] = decodeURIComponent(v);
      });
    }
    if (segments[0] === 'list' && segments[1]) return { screen: 'List', params: { listId: segments[1], ...params } };
    if (segments[0] === 'task' && segments[1]) return { screen: 'TaskDetail', params: { taskId: segments[1], ...params } };
    return null;
  } catch { return null; }
}

describe('Deep Link parsing', () => {
  it('parses ntask://list/:listId', () => {
    const result = parseDeepLink('ntask://list/abc123');
    expect(result).toEqual({ screen: 'List', params: { listId: 'abc123' } });
  });

  it('parses ntask://task/:taskId', () => {
    const result = parseDeepLink('ntask://task/task-xyz');
    expect(result).toEqual({ screen: 'TaskDetail', params: { taskId: 'task-xyz' } });
  });

  it('returns null for unknown paths', () => {
    expect(parseDeepLink('ntask://unknown/path')).toBeNull();
  });

  it('returns null for malformed URLs', () => {
    expect(parseDeepLink('')).toBeNull();
  });

  it('includes query params', () => {
    const result = parseDeepLink('ntask://task/abc?source=push');
    expect(result?.params.source).toBe('push');
  });
});
