#!/usr/bin/env node
/**
 * ɳTask MCP server — exposes task/list operations as MCP tools over stdio.
 *
 * Purpose:    Let AI agents (Claude, Cursor, etc.) manage ɳTask tasks/lists
 *             directly, using the same client lib as the ɳTask CLI.
 * Tools:      task_list, task_add, task_complete, task_search, task_update,
 *             list_lists, list_create.
 * Inputs:     JSON-RPC stdio per the MCP spec. Auth resolved once at start
 *             via session.ts (NTASK_TOKEN / NTASK_EMAIL+PASSWORD / stored
 *             CLI credentials).
 * Outputs:    Tool results as MCP content blocks + structuredContent.
 * Constraints: Never logs tokens. Every tool's errors surface as an MCP
 *             tool error (isError: true) with an actionable message rather
 *             than throwing and crashing the process.
 * SPORT:      n/a (MCP transport entrypoint).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import {
  getLists,
  getListTodos,
  getAllTodos,
  searchTodos,
  createTodo,
  updateTodo,
  toggleTodo,
  createList,
  findListByName,
  findTaskByIdOrTitle,
} from '@nself/ntask-cli/lib/tasks-api';
import { getSession } from './session.js';

const server = new McpServer({ name: 'ntask-mcp-server', version: '0.1.0' });

function toolError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
}

function jsonResult(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value as Record<string, unknown>,
  };
}

server.registerTool(
  'list_lists',
  {
    title: 'List all task lists',
    description: 'Return every ɳTask list (e.g. "My Tasks", "Work", "Personal") visible to the authenticated user.',
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  async () => {
    try {
      const session = await getSession();
      const lists = await getLists(session);
      return jsonResult({ lists });
    } catch (err) {
      return toolError(err);
    }
  },
);

server.registerTool(
  'list_create',
  {
    title: 'Create a task list',
    description: 'Create a new ɳTask list with the given title (and optional color/icon/description).',
    inputSchema: {
      title: z.string().min(1).describe('List title, e.g. "Groceries"'),
      color: z.string().optional().describe('Hex color for the list, e.g. "#4f46e5"'),
      icon: z.string().optional().describe('Icon identifier for the list'),
      description: z.string().optional().describe('Optional list description'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async ({ title, color, icon, description }) => {
    try {
      const session = await getSession();
      const list = await createList(session, { title, color, icon, description });
      return jsonResult({ list });
    } catch (err) {
      return toolError(err);
    }
  },
);

server.registerTool(
  'task_list',
  {
    title: 'List tasks',
    description:
      'Return tasks. If `list` is given (by name, fuzzy-matched), returns tasks in that list; otherwise returns all tasks, optionally filtered by completion status.',
    inputSchema: {
      list: z.string().optional().describe('List name to filter by (fuzzy-matched), e.g. "Work"'),
      completed: z.boolean().optional().describe('Filter by completion status (only used when `list` is omitted)'),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  async ({ list, completed }) => {
    try {
      const session = await getSession();
      if (list) {
        const found = await findListByName(session, list);
        if (!found) return toolError(new Error(`No list matching "${list}"`));
        const tasks = await getListTodos(session, found.id);
        return jsonResult({ list: found, tasks });
      }
      const tasks = await getAllTodos(session, completed);
      return jsonResult({ tasks });
    } catch (err) {
      return toolError(err);
    }
  },
);

server.registerTool(
  'task_add',
  {
    title: 'Add a task',
    description: 'Create a new task with a title, optionally targeting a list (by name), with priority/due date/notes.',
    inputSchema: {
      title: z.string().min(1).describe('Task title'),
      list: z.string().optional().describe('Target list name (fuzzy-matched); defaults to "My Tasks"'),
      priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).optional(),
      dueDate: z.string().optional().describe('ISO 8601 due date/time'),
      notes: z.string().optional(),
      description: z.string().optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async ({ title, list, priority, dueDate, notes, description }) => {
    try {
      const session = await getSession();
      const listName = list ?? 'My Tasks';
      const found = await findListByName(session, listName);
      if (!found) return toolError(new Error(`No list matching "${listName}". Call list_lists to see options.`));
      const task = await createTodo(session, {
        listId: found.id,
        title,
        priority,
        dueDate,
        notes,
        description,
      });
      return jsonResult({ task });
    } catch (err) {
      return toolError(err);
    }
  },
);

server.registerTool(
  'task_complete',
  {
    title: 'Complete (or reopen) a task',
    description: 'Mark a task complete by id or fuzzy title match. Set completed=false to reopen it instead.',
    inputSchema: {
      task: z.string().min(1).describe('Task id or a fuzzy title match'),
      completed: z.boolean().default(true).describe('true to complete, false to reopen'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ task, completed }) => {
    try {
      const session = await getSession();
      const all = await getAllTodos(session);
      const found = findTaskByIdOrTitle(all, task);
      if (!found) return toolError(new Error(`No task matching "${task}"`));
      const updated = await toggleTodo(session, found.id, completed ?? true);
      return jsonResult({ task: updated });
    } catch (err) {
      return toolError(err);
    }
  },
);

server.registerTool(
  'task_search',
  {
    title: 'Search tasks',
    description: 'Full-text (ILIKE) search over task titles.',
    inputSchema: {
      query: z.string().min(1).describe('Search text to match against task titles'),
      limit: z.number().int().min(1).max(100).default(20),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  async ({ query, limit }) => {
    try {
      const session = await getSession();
      const tasks = await searchTodos(session, query, limit);
      return jsonResult({ tasks });
    } catch (err) {
      return toolError(err);
    }
  },
);

server.registerTool(
  'task_update',
  {
    title: 'Update a task',
    description: 'Update fields on an existing task (title, description, priority, notes, due date, completion).',
    inputSchema: {
      task: z.string().min(1).describe('Task id or a fuzzy title match'),
      title: z.string().optional(),
      description: z.string().optional(),
      priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).optional(),
      notes: z.string().optional(),
      dueDate: z.string().optional().describe('ISO 8601 due date/time'),
      completed: z.boolean().optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ task, title, description, priority, notes, dueDate, completed }) => {
    try {
      const session = await getSession();
      const all = await getAllTodos(session);
      const found = findTaskByIdOrTitle(all, task);
      if (!found) return toolError(new Error(`No task matching "${task}"`));
      const updated = await updateTodo(session, {
        id: found.id,
        title,
        description,
        priority,
        notes,
        dueDate,
        completed,
      });
      return jsonResult({ task: updated });
    } catch (err) {
      return toolError(err);
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(`ntask-mcp: fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
