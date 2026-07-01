#!/usr/bin/env node
/**
 * ɳTask CLI entrypoint — terminal + AI-agent control surface for ɳTasks.
 *
 * Purpose:    Wire commander subcommands to command implementations
 *             (commands/login.ts, commands/tasks.ts). Sets meaningful
 *             process exit codes for scripting.
 * Inputs:     process.argv.
 * Outputs:    stdout (table or --json), stderr (errors), exit code.
 * Constraints: Every subcommand accepts --json, --endpoint, --api-url,
 *             --auth-url, --profile per the shared CommonOpts contract.
 * SPORT:      n/a (CLI entrypoint).
 */

import { Command } from 'commander';
import { runLogin } from './commands/login.js';
import {
  runLists,
  runLs,
  runAdd,
  runDone,
  runRm,
  runSearch,
  runToday,
  runUpcoming,
} from './commands/tasks.js';

const program = new Command();

program
  .name('ntask')
  .description('ɳTask CLI — manage tasks and lists from the terminal or an AI agent')
  .version('0.1.0');

function withCommonOpts(cmd: Command): Command {
  return cmd
    .option('--json', 'output raw JSON instead of a table')
    .option('--endpoint <name>', 'named endpoint preset: local | staging | prod')
    .option('--api-url <url>', 'override GraphQL endpoint URL')
    .option('--auth-url <url>', 'override auth endpoint URL')
    .option('--profile <name>', 'named credentials profile (defaults to endpoint name)');
}

withCommonOpts(program.command('login <email>'))
  .description('authenticate and store credentials in ~/.config/ntask/credentials.json')
  .option('--password <password>', 'password (non-interactive; prefer the hidden prompt)')
  .action(async (email: string, opts) => {
    process.exitCode = await runLogin(email, opts);
  });

withCommonOpts(program.command('lists'))
  .description('show all your lists')
  .action(async (opts) => {
    process.exitCode = await runLists(opts);
  });

withCommonOpts(program.command('ls [list]'))
  .description('show tasks in a list (or all tasks if omitted)')
  .action(async (list: string | undefined, opts) => {
    process.exitCode = await runLs(list, opts);
  });

withCommonOpts(program.command('add <title>'))
  .description('add a new task')
  .option('-l, --list <list>', 'target list name (default: "My Tasks")')
  .option('-d, --due <date>', 'due date (ISO 8601)')
  .option('-p, --priority <priority>', 'none | low | medium | high | urgent')
  .option('--tags <tags>', 'comma-separated tag names (reserved; not yet wired)')
  .action(async (title: string, opts) => {
    process.exitCode = await runAdd(title, opts);
  });

withCommonOpts(program.command('done <idOrFuzzy>'))
  .description('mark a task complete (matches by id or title)')
  .action(async (idOrFuzzy: string, opts) => {
    process.exitCode = await runDone(idOrFuzzy, opts);
  });

withCommonOpts(program.command('rm <idOrFuzzy>'))
  .description('delete a task (matches by id or title)')
  .action(async (idOrFuzzy: string, opts) => {
    process.exitCode = await runRm(idOrFuzzy, opts);
  });

withCommonOpts(program.command('search <query>'))
  .description('search tasks by title')
  .action(async (query: string, opts) => {
    process.exitCode = await runSearch(query, opts);
  });

withCommonOpts(program.command('today'))
  .description('show tasks due today (and overdue)')
  .action(async (opts) => {
    process.exitCode = await runToday(opts);
  });

withCommonOpts(program.command('upcoming'))
  .description('show tasks due in the next N days (default 7)')
  .option('--days <n>', 'number of days to look ahead', '7')
  .action(async (opts) => {
    process.exitCode = await runUpcoming({ ...opts, days: Number(opts.days) });
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(`ntask: fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
