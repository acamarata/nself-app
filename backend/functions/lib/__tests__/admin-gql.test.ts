// Purpose: Unit tests for the shared Hasura admin GraphQL client.
// Focus: the `errors`-array handling that the five duplicated helpers got wrong —
//   Hasura answers a failed operation with HTTP 200 and { errors: [...] }, so
//   `res.ok` alone reports every failure as a success.
// Run: node --import tsx --test lib/__tests__/admin-gql.test.ts
// SPORT: F08 backend functions

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { adminGql, HasuraGqlError, operationName } from '../admin-gql';

/** Build a stub fetch that returns one canned response and records the call. */
function stubFetch(
  init: { status?: number; body: string }
): { fetchImpl: typeof fetch; calls: Array<{ url: string; init: RequestInit }> } {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = (async (url: string, requestInit: RequestInit) => {
    calls.push({ url, init: requestInit });
    const status = init.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => init.body,
    };
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const OPTS = { url: 'http://hasura.test/v1/graphql', adminSecret: 's3cret' };

describe('operationName', () => {
  it('extracts a named query', () => {
    assert.equal(operationName('query ExportUserData($id: uuid!) { x }'), 'ExportUserData');
  });

  it('extracts a named mutation', () => {
    assert.equal(operationName('mutation DeleteUserData { y }'), 'DeleteUserData');
  });

  it('falls back to "anonymous" for an unnamed document', () => {
    assert.equal(operationName('{ np_todos { id } }'), 'anonymous');
  });
});

describe('adminGql — success path', () => {
  it('returns the data payload, not the envelope', async () => {
    const { fetchImpl } = stubFetch({ body: JSON.stringify({ data: { np_todos: [{ id: '1' }] } }) });
    const data = await adminGql<{ np_todos: Array<{ id: string }> }>(
      'query GetTodos { np_todos { id } }',
      {},
      { ...OPTS, fetchImpl }
    );
    assert.deepEqual(data, { np_todos: [{ id: '1' }] });
  });

  it('treats an empty errors array as success', async () => {
    const { fetchImpl } = stubFetch({ body: JSON.stringify({ data: { ok: true }, errors: [] }) });
    const data = await adminGql('query Ping { ok }', {}, { ...OPTS, fetchImpl });
    assert.deepEqual(data, { ok: true });
  });

  it('sends the admin secret, endpoint, query and variables', async () => {
    const { fetchImpl, calls } = stubFetch({ body: JSON.stringify({ data: { ok: true } }) });
    await adminGql('query Ping { ok }', { userId: 'u-1' }, { ...OPTS, fetchImpl });

    assert.equal(calls.length, 1);
    const call = calls[0]!;
    assert.equal(call.url, 'http://hasura.test/v1/graphql');
    assert.equal(call.init.method, 'POST');
    const headers = call.init.headers as Record<string, string>;
    assert.equal(headers['x-hasura-admin-secret'], 's3cret');
    assert.equal(headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(call.init.body as string), {
      query: 'query Ping { ok }',
      variables: { userId: 'u-1' },
    });
  });
});

describe('adminGql — errors array (the regression this module exists for)', () => {
  it('throws on HTTP 200 with a non-empty errors array', async () => {
    const body = JSON.stringify({
      errors: [{ message: "field 'owner_id' not found in type: 'np_lists_bool_exp'" }],
    });
    const { fetchImpl } = stubFetch({ status: 200, body });

    await assert.rejects(
      () => adminGql('query ExportUserData { np_lists { id } }', {}, { ...OPTS, fetchImpl }),
      (err: unknown) => {
        assert.ok(err instanceof HasuraGqlError);
        assert.equal(err.status, 200);
        assert.equal(err.operation, 'ExportUserData');
        assert.equal(err.errors.length, 1);
        assert.match(err.message, /owner_id/);
        return true;
      }
    );
  });

  it('throws even when Hasura returns partial data alongside errors', async () => {
    const body = JSON.stringify({
      data: { np_todos: [{ id: '1' }], np_lists: null },
      errors: [{ message: "field 'emoji' not found in type: 'np_lists'" }],
    });
    const { fetchImpl } = stubFetch({ body });

    await assert.rejects(
      () => adminGql('query Mixed { np_todos { id } }', {}, { ...OPTS, fetchImpl }),
      HasuraGqlError
    );
  });

  it('joins every error message so no failure is hidden behind the first', async () => {
    const body = JSON.stringify({
      errors: [{ message: 'first failure' }, { message: 'second failure' }],
    });
    const { fetchImpl } = stubFetch({ body });

    await assert.rejects(
      () => adminGql('mutation Multi { a b }', {}, { ...OPTS, fetchImpl }),
      (err: unknown) => {
        assert.ok(err instanceof HasuraGqlError);
        assert.match(err.message, /first failure/);
        assert.match(err.message, /second failure/);
        assert.equal(err.errors.length, 2);
        return true;
      }
    );
  });

  it('surfaces a malformed error entry rather than crashing on it', async () => {
    const { fetchImpl } = stubFetch({ body: JSON.stringify({ errors: [{ code: 'oops' }] }) });
    await assert.rejects(
      () => adminGql('query Weird { x }', {}, { ...OPTS, fetchImpl }),
      (err: unknown) => {
        assert.ok(err instanceof HasuraGqlError);
        assert.match(err.message, /oops/);
        return true;
      }
    );
  });
});

describe('adminGql — transport and shape failures', () => {
  it('throws on a non-2xx response', async () => {
    const { fetchImpl } = stubFetch({ status: 500, body: 'upstream exploded' });
    await assert.rejects(
      () => adminGql('query Ping { ok }', {}, { ...OPTS, fetchImpl }),
      (err: unknown) => {
        assert.ok(err instanceof HasuraGqlError);
        assert.equal(err.status, 500);
        assert.match(err.message, /HTTP 500/);
        return true;
      }
    );
  });

  it('throws on a non-JSON body', async () => {
    const { fetchImpl } = stubFetch({ body: '<html>502 Bad Gateway</html>' });
    await assert.rejects(
      () => adminGql('query Ping { ok }', {}, { ...OPTS, fetchImpl }),
      (err: unknown) => {
        assert.ok(err instanceof HasuraGqlError);
        assert.match(err.message, /non-JSON body/);
        return true;
      }
    );
  });

  it('throws when data is absent and no errors were reported', async () => {
    const { fetchImpl } = stubFetch({ body: JSON.stringify({}) });
    await assert.rejects(
      () => adminGql('query Ping { ok }', {}, { ...OPTS, fetchImpl }),
      (err: unknown) => {
        assert.ok(err instanceof HasuraGqlError);
        assert.match(err.message, /no data payload/);
        return true;
      }
    );
  });

  it('throws when data is explicitly null', async () => {
    const { fetchImpl } = stubFetch({ body: JSON.stringify({ data: null }) });
    await assert.rejects(
      () => adminGql('query Ping { ok }', {}, { ...OPTS, fetchImpl }),
      HasuraGqlError
    );
  });

  it('propagates a fetch-level rejection', async () => {
    const fetchImpl = (async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    await assert.rejects(
      () => adminGql('query Ping { ok }', {}, { ...OPTS, fetchImpl }),
      /ECONNREFUSED/
    );
  });
});

describe('adminGql — configuration', () => {
  it('reads endpoint and secret from env when not passed explicitly', async () => {
    const { fetchImpl, calls } = stubFetch({ body: JSON.stringify({ data: { ok: true } }) });
    const prevUrl = process.env['HASURA_GRAPHQL_URL'];
    const prevSecret = process.env['HASURA_GRAPHQL_ADMIN_SECRET'];
    process.env['HASURA_GRAPHQL_URL'] = 'http://env-hasura/v1/graphql';
    process.env['HASURA_GRAPHQL_ADMIN_SECRET'] = 'env-secret';
    try {
      await adminGql('query Ping { ok }', {}, { fetchImpl });
      const call = calls[0]!;
      assert.equal(call.url, 'http://env-hasura/v1/graphql');
      assert.equal(
        (call.init.headers as Record<string, string>)['x-hasura-admin-secret'],
        'env-secret'
      );
    } finally {
      if (prevUrl === undefined) delete process.env['HASURA_GRAPHQL_URL'];
      else process.env['HASURA_GRAPHQL_URL'] = prevUrl;
      if (prevSecret === undefined) delete process.env['HASURA_GRAPHQL_ADMIN_SECRET'];
      else process.env['HASURA_GRAPHQL_ADMIN_SECRET'] = prevSecret;
    }
  });
});
