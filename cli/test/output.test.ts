import { describe, it, expect, vi, afterEach } from 'vitest';
import { printTable, printJson } from '../src/lib/output.js';

describe('printJson', () => {
  afterEach(() => vi.restoreAllMocks());

  it('outputs valid parseable JSON', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printJson({ ok: true, value: 42 });
    expect(spy).toHaveBeenCalledTimes(1);
    const output = spy.mock.calls[0][0] as string;
    expect(JSON.parse(output)).toEqual({ ok: true, value: 42 });
  });
});

describe('printTable', () => {
  afterEach(() => vi.restoreAllMocks());

  it('prints "(no results)" for an empty array', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printTable([], [{ header: 'A', value: () => '' }]);
    expect(spy).toHaveBeenCalledWith('(no results)');
  });

  it('prints a header, separator, and one row per item', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printTable(
      [{ name: 'foo' }, { name: 'barbaz' }],
      [{ header: 'NAME', value: (r: { name: string }) => r.name }],
    );
    expect(spy).toHaveBeenCalledTimes(4); // header + separator + 2 rows
  });
});
