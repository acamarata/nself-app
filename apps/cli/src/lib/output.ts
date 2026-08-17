/**
 * Terminal output formatting: pretty tables (default) or raw JSON (--json).
 *
 * Purpose:    Give every CLI command consistent human + machine output
 *             without each command re-implementing table/JSON rendering.
 * Inputs:     Rows (array of plain objects) + column list, or any JSON-
 *             serializable value for --json mode.
 * Outputs:    Writes to stdout. Table mode uses simple fixed-width columns
 *             (no external table library — keeps the CLI dependency-light).
 * Constraints: JSON mode must be the ONLY thing printed to stdout when
 *             --json is set (no decorative text) so it's always valid JSON
 *             for agent/script consumption.
 * SPORT:      n/a (presentation layer).
 */

export interface Column<T> {
  readonly header: string;
  readonly value: (row: T) => string;
  readonly width?: number;
}

/** Print a fixed-width table of rows to stdout. */
export function printTable<T>(rows: readonly T[], columns: ReadonlyArray<Column<T>>): void {
  if (rows.length === 0) {
    console.log('(no results)');
    return;
  }

  const widths = columns.map((col) => {
    const dataWidth = Math.max(...rows.map((r) => col.value(r).length));
    return Math.max(col.header.length, dataWidth, col.width ?? 0);
  });

  const pad = (s: string, w: number) => s.padEnd(w, ' ');

  const headerLine = columns.map((col, i) => pad(col.header, widths[i] ?? col.header.length)).join('  ');
  const sepLine = widths.map((w) => '-'.repeat(w)).join('  ');
  console.log(headerLine);
  console.log(sepLine);

  for (const row of rows) {
    console.log(columns.map((col, i) => pad(col.value(row), widths[i] ?? 0)).join('  '));
  }
}

/** Print a value as JSON only (for --json mode) — no other stdout writes allowed alongside this. */
export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

/** Print a short human success/info message (skipped entirely in --json mode by caller). */
export function printInfo(message: string): void {
  console.log(message);
}

/** Print an error message to stderr, consistently prefixed. */
export function printError(message: string): void {
  console.error(`ntask: error: ${message}`);
}
