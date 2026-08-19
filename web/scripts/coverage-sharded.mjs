/**
 * coverage-sharded.mjs — memory-bounded coverage for ntask's "Web Tests" leg.
 *
 * Purpose:    ntask's suite cannot collect coverage in one vitest process on the
 *             3.7GB self-hosted runner (one pathological test loop + cross-file
 *             jsdom pollution surfaced once the OOM was fixed). This runs the
 *             suite as N separate vitest processes (each fresh → bounded RSS,
 *             fully isolated), then merges their istanbul JSON and enforces the
 *             real thresholds on the COMBINED total.
 * Inputs:     none (shards defined in vitest.shard.config.ts).
 * Outputs:    coverage/coverage-final.json (merged), coverage/lcov.info, text
 *             summary to stdout. Exit 1 if any shard fails a test or the merged
 *             coverage misses a threshold.
 * Constraints: thresholds below MUST match vitest.config.ts coverage.thresholds.
 * SOT:        web/ntask CI memory fix (2026-07-06)
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { readFileSync, rmSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const root = path.resolve(import.meta.dirname, '..')

// Thresholds — keep in lockstep with vitest.config.ts.
const THRESHOLDS = { lines: 54, functions: 40, branches: 40 }
const SHARDS = ['1', '2']

// Resolve istanbul libs via @vitest/coverage-istanbul's own dependency tree
// (guaranteed present; not hoisted to ntask, so anchor the paths there).
const ciEntry = require.resolve('@vitest/coverage-istanbul', { paths: [root] })
const fromCi = (id) => require(require.resolve(id, { paths: [path.dirname(ciEntry)] }))
const libCoverage = fromCi('istanbul-lib-coverage')
const libReport = fromCi('istanbul-lib-report')
const reports = fromCi('istanbul-reports')

// Fresh coverage dir.
const covDir = path.join(root, 'coverage')
if (existsSync(covDir)) rmSync(covDir, { recursive: true, force: true })
mkdirSync(covDir, { recursive: true })

// Run each shard in its own process.
for (const shard of SHARDS) {
  console.log(`\n=== ntask coverage shard ${shard}/${SHARDS.length} ===`)
  const res = spawnSync(
    'npx',
    ['vitest', 'run', '--coverage', '--config', 'vitest.shard.config.ts'],
    {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, NTASK_SHARD: shard, CI: 'true' },
    },
  )
  if (res.status !== 0) {
    console.error(`\nntask coverage: shard ${shard} failed (exit ${res.status}). Aborting.`)
    process.exit(res.status ?? 1)
  }
}

// Merge per-shard istanbul JSON.
const map = libCoverage.createCoverageMap({})
for (const shard of SHARDS) {
  const file = path.join(covDir, `shard-${shard}`, 'coverage-final.json')
  if (!existsSync(file)) {
    console.error(`ntask coverage: missing shard report ${file}`)
    process.exit(1)
  }
  map.merge(JSON.parse(readFileSync(file, 'utf8')))
}

// Emit merged text + lcov + json.
const context = libReport.createContext({ dir: covDir, coverageMap: map })
reports.create('text').execute(context)
reports.create('lcovonly').execute(context)
reports.create('json').execute(context)

// Enforce thresholds on the merged total.
const summary = map.getCoverageSummary()
let failed = false
for (const [metric, min] of Object.entries(THRESHOLDS)) {
  const pct = summary[metric].pct
  if (pct < min) {
    console.error(`ERROR: merged coverage for ${metric} (${pct}%) is below threshold (${min}%)`)
    failed = true
  } else {
    console.log(`OK: merged ${metric} ${pct}% >= ${min}%`)
  }
}
process.exit(failed ? 1 : 0)
