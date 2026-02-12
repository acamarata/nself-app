import { gql } from 'graphql-request';
import type { DatabaseAdapter, QueryOptions, MutationResult} from '@/lib/types/backend';
import { getGraphQLClient } from './graphql-client';
import { Tables } from '@/lib/utils/tables';

/** Table-specific default field sets so queries return full objects, not just { id } */
const TABLE_FIELDS: Record<string, string> = {
  [Tables.TODOS]: 'id user_id list_id title description completed is_public position created_at updated_at',
  [Tables.PROFILES]: 'id email display_name avatar_url bio created_at updated_at',
  [Tables.TODO_SHARES]: 'id todo_id shared_with_email permission created_at',
  [Tables.LISTS]: 'id user_id title description color icon is_default position created_at updated_at',
  [Tables.LIST_SHARES]: 'id list_id shared_with_user_id shared_with_email permission invited_by accepted_at created_at updated_at',
  [Tables.LIST_PRESENCE]: 'id list_id user_id status editing_todo_id last_seen_at created_at',
};

function getFieldsForTable(table: string, select?: string): string {
  if (select) return select;
  return TABLE_FIELDS[table] || 'id created_at updated_at';
}

function buildWhereClause(where?: Record<string, unknown>): string {
  if (!where || Object.keys(where).length === 0) return '';
  const conditions = Object.entries(where)
    .map(([key, value]) => {
      if (typeof value === 'string') return `${key}: {_eq: "${value}"}`;
      return `${key}: {_eq: ${JSON.stringify(value)}}`;
    })
    .join(', ');
  return `where: {${conditions}}`;
}

function buildOrderByClause(orderBy?: { column: string; ascending?: boolean }[]): string {
  if (!orderBy || orderBy.length === 0) return '';
  const orders = orderBy.map((o) => `${o.column}: ${o.ascending !== false ? 'asc' : 'desc'}`).join(', ');
  return `order_by: {${orders}}`;
}

export function createNselfDatabase(): DatabaseAdapter {
  return {
    async query<T = unknown>(table: string, options?: QueryOptions): Promise<MutationResult<T[]>> {
      try {
        const client = getGraphQLClient();
        const args: string[] = [];
        const whereClause = buildWhereClause(options?.where);
        if (whereClause) args.push(whereClause);
        const orderByClause = buildOrderByClause(options?.orderBy);
        if (orderByClause) args.push(orderByClause);
        if (options?.limit) args.push(`limit: ${options.limit}`);
        if (options?.offset) args.push(`offset: ${options.offset}`);

        const argsStr = args.length > 0 ? `(${args.join(', ')})` : '';
        const fields = getFieldsForTable(table, options?.select);

        const query = gql`query { ${table}${argsStr} { ${fields} } }`;
        const data = await client.request<Record<string, T[]>>(query);
        return { data: data[table] || [], error: null };
      } catch (err) {
        return { data: null, error: (err as Error).message };
      }
    },

    async queryById<T = unknown>(table: string, id: string): Promise<MutationResult<T>> {
      try {
        const client = getGraphQLClient();
        const fields = getFieldsForTable(table);
        const query = gql`query ($id: uuid!) { ${table}_by_pk(id: $id) { ${fields} } }`;
        const data = await client.request<Record<string, T>>(query, { id });
        return { data: data[`${table}_by_pk`] || null, error: null };
      } catch (err) {
        return { data: null, error: (err as Error).message };
      }
    },

    async insert<T = unknown>(table: string, insertData: Record<string, unknown>): Promise<MutationResult<T>> {
      try {
        const client = getGraphQLClient();
        const mutation = gql`
          mutation ($object: ${table}_insert_input!) {
            insert_${table}_one(object: $object) { ${getFieldsForTable(table)} }
          }
        `;
        const data = await client.request<Record<string, T>>(mutation, { object: insertData });
        return { data: data[`insert_${table}_one`] || null, error: null };
      } catch (err) {
        return { data: null, error: (err as Error).message };
      }
    },

    async update<T = unknown>(table: string, id: string, updateData: Record<string, unknown>): Promise<MutationResult<T>> {
      try {
        const client = getGraphQLClient();
        const mutation = gql`
          mutation ($id: uuid!, $set: ${table}_set_input!) {
            update_${table}_by_pk(pk_columns: {id: $id}, _set: $set) { ${getFieldsForTable(table)} }
          }
        `;
        const data = await client.request<Record<string, T>>(mutation, { id, set: updateData });
        return { data: data[`update_${table}_by_pk`] || null, error: null };
      } catch (err) {
        return { data: null, error: (err as Error).message };
      }
    },

    async remove(table: string, id: string): Promise<MutationResult<null>> {
      try {
        const client = getGraphQLClient();
        const mutation = gql`
          mutation ($id: uuid!) {
            delete_${table}_by_pk(id: $id) { id }
          }
        `;
        await client.request(mutation, { id });
        return { data: null, error: null };
      } catch (err) {
        return { data: null, error: (err as Error).message };
      }
    },

    async rpc<T = unknown>(functionName: string, params?: Record<string, unknown>): Promise<MutationResult<T>> {
      try {
        const client = getGraphQLClient();
        const argDefs = params
          ? Object.entries(params).map(([key]) => `$${key}: String`).join(', ')
          : '';
        const argPass = params
          ? Object.keys(params).map((key) => `${key}: $${key}`).join(', ')
          : '';

        const query = gql`
          query${argDefs ? `(${argDefs})` : ''} {
            ${functionName}${argPass ? `(${argPass})` : ''}
          }
        `;
        const data = await client.request<Record<string, T>>(query, params);
        return { data: data[functionName] || null, error: null };
      } catch (err) {
        return { data: null, error: (err as Error).message };
      }
    },
  };
}
