/**
 * Task/list CLI command implementations: lists, ls, add, done, rm, search,
 * today, upcoming.
 *
 * Purpose:    Translate parsed CLI args into tasks-api.ts calls and render
 *             either a table (default) or JSON (--json).
 * Inputs:     Command-specific args/options (see each function) + a resolved
 *             ActiveSession (via getActiveSession in session.ts).
 * Outputs:    stdout table/JSON; process exit code via return value
 *             (0 = success, 1 = user/usage error, 2 = not-found).
 * Constraints: Every command supports --json; JSON mode never mixes in
 *             human-readable text on stdout.
 * SPORT:      n/a (CLI command layer).
 */

import { getActiveSession } from '../lib/session.js';
import {
  getLists,
  getListTodos,
  getAllTodos,
  getTodosDueBetween,
  getTodosDueBefore,
  searchTodos,
  createTodo,
  toggleTodo,
  deleteTodo,
  findListByName,
  findTaskByIdOrTitle,
  type Task,
  type TaskList,
} from '../lib/tasks-api.js';
import { printTable, printJson, printInfo, printError } from '../lib/output.js';

export interface CommonOpts {
  readonly endpoint?: string;
  readonly apiUrl?: string;
  readonly authUrl?: string;
  readonly profile?: string;
  readonly json?: boolean;
}

const TASK_COLUMNS = [
  { header: 'ID', value: (t: Task) => t.id.slice(0, 8) },
  { header: 'DONE', value: (t: Task) => (t.completed ? 'x' : ' ') },
  { header: 'PRI', value: (t: Task) => t.priority ?? 'none' },
  { header: 'DUE', value: (t: Task) => (t.due_date ? t.due_date.slice(0, 10) : '-') },
  { header: 'TITLE', value: (t: Task) => t.title },
];

const LIST_COLUMNS = [
  { header: 'ID', value: (l: TaskList) => l.id.slice(0, 8) },
  { header: 'TITLE', value: (l: TaskList) => l.title },
  { header: 'DEFAULT', value: (l: TaskList) => (l.is_default ? 'x' : ' ') },
];

export async function runLists(opts: CommonOpts): Promise<number> {
  try {
    const session = getActiveSession(opts);
    const lists = await getLists(session);
    if (opts.json) {
      printJson(lists);
    } else {
      printTable(lists, LIST_COLUMNS);
    }
    return 0;
  } catch (err) {
    return fail(err, opts);
  }
}

export async function runLs(listName: string | undefined, opts: CommonOpts): Promise<number> {
  try {
    const session = getActiveSession(opts);
    let tasks: Task[];

    if (listName) {
      const list = await findListByName(session, listName);
      if (!list) {
        printError(`No list matching "${listName}"`);
        return 2;
      }
      tasks = await getListTodos(session, list.id);
    } else {
      tasks = await getAllTodos(session);
    }

    if (opts.json) {
      printJson(tasks);
    } else {
      printTable(tasks, TASK_COLUMNS);
    }
    return 0;
  } catch (err) {
    return fail(err, opts);
  }
}

export interface AddOpts extends CommonOpts {
  readonly list?: string;
  readonly due?: string;
  readonly priority?: string;
  readonly tags?: string;
}

export async function runAdd(title: string, opts: AddOpts): Promise<number> {
  try {
    const session = getActiveSession(opts);
    const listName = opts.list ?? 'My Tasks';
    const list = await findListByName(session, listName);
    if (!list) {
      printError(`No list matching "${listName}". Run \`ntask lists\` to see available lists.`);
      return 2;
    }

    const task = await createTodo(session, {
      listId: list.id,
      title,
      priority: opts.priority,
      dueDate: opts.due,
    });

    if (opts.json) {
      printJson(task);
    } else {
      printInfo(`Added "${task.title}" to ${list.title} (${task.id.slice(0, 8)})`);
    }
    return 0;
  } catch (err) {
    return fail(err, opts);
  }
}

async function resolveTaskByFuzzyId(session: ReturnType<typeof getActiveSession>, idOrFuzzy: string): Promise<Task | undefined> {
  const all = await getAllTodos(session);
  return findTaskByIdOrTitle(all, idOrFuzzy);
}

export async function runDone(idOrFuzzy: string, opts: CommonOpts): Promise<number> {
  try {
    const session = getActiveSession(opts);
    const task = await resolveTaskByFuzzyId(session, idOrFuzzy);
    if (!task) {
      printError(`No task matching "${idOrFuzzy}"`);
      return 2;
    }
    const updated = await toggleTodo(session, task.id, true);
    if (opts.json) {
      printJson(updated);
    } else {
      printInfo(`Completed "${updated.title}"`);
    }
    return 0;
  } catch (err) {
    return fail(err, opts);
  }
}

export async function runRm(idOrFuzzy: string, opts: CommonOpts): Promise<number> {
  try {
    const session = getActiveSession(opts);
    const task = await resolveTaskByFuzzyId(session, idOrFuzzy);
    if (!task) {
      printError(`No task matching "${idOrFuzzy}"`);
      return 2;
    }
    const deleted = await deleteTodo(session, task.id);
    if (opts.json) {
      printJson(deleted);
    } else {
      printInfo(`Removed "${deleted?.title ?? task.title}"`);
    }
    return 0;
  } catch (err) {
    return fail(err, opts);
  }
}

export async function runSearch(query: string, opts: CommonOpts): Promise<number> {
  try {
    const session = getActiveSession(opts);
    const results = await searchTodos(session, query);
    if (opts.json) {
      printJson(results);
    } else {
      printTable(results, TASK_COLUMNS);
    }
    return 0;
  } catch (err) {
    return fail(err, opts);
  }
}

export async function runToday(opts: CommonOpts): Promise<number> {
  try {
    const session = getActiveSession(opts);
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
    // Include anything already overdue as well as due today, matching typical "today" UX.
    const [dueToday, overdue] = await Promise.all([
      getTodosDueBetween(session, startOfDay, endOfDay),
      getTodosDueBefore(session, startOfDay),
    ]);
    const merged = [...overdue, ...dueToday];

    if (opts.json) {
      printJson(merged);
    } else {
      printTable(merged, TASK_COLUMNS);
    }
    return 0;
  } catch (err) {
    return fail(err, opts);
  }
}

export async function runUpcoming(opts: CommonOpts & { readonly days?: number }): Promise<number> {
  try {
    const session = getActiveSession(opts);
    const days = opts.days ?? 7;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
    const tasks = await getTodosDueBetween(session, start, end);

    if (opts.json) {
      printJson(tasks);
    } else {
      printTable(tasks, TASK_COLUMNS);
    }
    return 0;
  } catch (err) {
    return fail(err, opts);
  }
}

function fail(err: unknown, opts: CommonOpts): number {
  const message = err instanceof Error ? err.message : String(err);
  if (opts.json) {
    printJson({ ok: false, error: message });
  } else {
    printError(message);
  }
  return 1;
}
