#!/usr/bin/env node
/**
 * sync-sport.mjs — Build-time SPORT import for web/ntask
 *
 * Pulls canonical facts from the PPI source of truth into a generated
 * JSON module that app code imports. Never hand-write versions, bundle
 * membership, pricing, or plugin lists in web/ntask — edit the SPORT
 * files + MASTER-VERSIONS.md instead.
 *
 * Doctrine: ~/Sites/nself/.claude/docs/doctrines/doc-sync-ritual.md
 *
 * Sources:
 *   .claude/docs/MASTER-VERSIONS.md           → versions table
 *   .claude/docs/sport/F06-BUNDLE-INVENTORY.md → bundles
 *   .claude/docs/sport/F07-PRICING-TIERS.md    → tiers + pricing
 *   .claude/docs/sport/F03-PLUGIN-INVENTORY-FREE.md → free plugins
 *   .claude/docs/sport/F04-PLUGIN-INVENTORY-PRO.md  → pro plugins
 *
 * Output:
 *   web/ntask/src/generated/sport.json
 *
 * Fails the build if any source file is missing or malformed.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'

const CHECK_MODE = process.argv.includes('--check')
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')                     // web/ntask
const webRoot = resolve(repoRoot, '..')                        // web
const projectRoot = resolve(webRoot, '..')                     // ~/Sites/nself
const claudeDocs = resolve(projectRoot, '.claude/docs')
const sportDir = resolve(claudeDocs, 'sport')

const sources = {
  masterVersions: resolve(claudeDocs, 'MASTER-VERSIONS.md'),
  bundles: resolve(sportDir, 'F06-BUNDLE-INVENTORY.md'),
  pricing: resolve(sportDir, 'F07-PRICING-TIERS.md'),
  pluginsFree: resolve(sportDir, 'F03-PLUGIN-INVENTORY-FREE.md'),
  pluginsPro: resolve(sportDir, 'F04-PLUGIN-INVENTORY-PRO.md'),
}

const OUT_PATH = resolve(repoRoot, 'src/generated/sport.json')

function anySourceMissing() {
  return Object.entries(sources).some(([, p]) => !existsSync(p))
}

if (anySourceMissing()) {
  // In environments without the PPI-level .claude/docs/ (e.g. Vercel build, which
  // only checks out the web/ repo), fall back to the previously-generated file
  // that is committed to git. Refusing to build here would block production deploys.
  if (existsSync(OUT_PATH)) {
    console.warn(`[sync-sport] WARNING: one or more SPORT sources missing — using existing ${OUT_PATH}`)
    console.warn(`[sync-sport] This is expected on Vercel (web/ checkout only). Local dev with PPI .claude/docs/ regenerates normally.`)
    process.exit(0)
  }
  // No existing output and no sources — can't proceed.
  for (const [label, p] of Object.entries(sources)) {
    if (!existsSync(p)) {
      console.error(`[sync-sport] FATAL: source missing — ${label} at ${p} (and no existing ${OUT_PATH} to fall back to)`)
    }
  }
  console.error(`[sync-sport] Run from a checkout that has the PPI .claude/docs/ present, or commit src/generated/sport.json.`)
  process.exit(1)
}

function readSource(label, path) {
  return readFileSync(path, 'utf8')
}

// ----- Parsers -----

function parseMasterVersions(md) {
  // Pull the first markdown table whose header has "Artifact" and "Current"
  const lines = md.split('\n')
  let inTable = false
  const rows = []
  for (const line of lines) {
    if (/^\|\s*Artifact\s*\|/i.test(line)) {
      inTable = true
      continue
    }
    if (inTable) {
      if (/^\|\s*---/.test(line)) continue
      if (!line.trim().startsWith('|')) {
        if (rows.length) break
        continue
      }
      const cells = line.split('|').slice(1, -1).map((c) => c.trim())
      if (cells.length >= 2) {
        const artifact = cells[0].replace(/\*\*/g, '').replace(/`/g, '').trim()
        const currentRaw = cells[1].replace(/\*\*/g, '').replace(/`/g, '').trim()
        const current = currentRaw.split(/\s/)[0]
        if (artifact && current) rows.push({ artifact, current })
      }
    }
  }
  if (!rows.length) {
    console.error('[sync-sport] FATAL: could not parse any versions from MASTER-VERSIONS.md')
    process.exit(1)
  }
  return rows
}

function stripAnnotation(str) {
  return str.replace(/\s*\([^)]*\)\s*$/g, '').replace(/^~/, '').trim()
}

function parseBundles(md) {
  // F06 format: each bundle has "## Bundle N: Name" + bullet list with Monthly / What it unlocks.
  // Fallback: single-table rows "| **Name** | $X.XX/mo | plugin list |".
  const bundles = []
  const bundleSections = md.split(/^##\s+Bundle\s+\d+:\s+/m).slice(1)
  for (const section of bundleSections) {
    const firstLine = section.split('\n')[0] || ''
    const name = firstLine.trim()
    const priceMatch = section.match(/\*\*Monthly:\*\*\s*([^\n]+)/i)
    const annualMatch = section.match(/\*\*Annual:\*\*\s*([^\n]+)/i)
    const unlocksMatch = section.match(/\*\*What it unlocks:\*\*\s*([^\n]+)/i)
    if (name) {
      bundles.push({
        name,
        annual: annualMatch ? stripAnnotation(annualMatch[1].trim()) : '',
        price: priceMatch ? stripAnnotation(priceMatch[1].trim()) : '',
        unlocks: unlocksMatch ? unlocksMatch[1].trim() : '',
      })
    }
  }
  if (!bundles.length) {
    // Fallback parser for a simple table.
    for (const line of md.split('\n')) {
      const m = line.match(/^\|\s*\*\*([^*]+)\*\*\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/)
      if (m && /\$/.test(m[2])) {
        bundles.push({ name: m[1].trim(), price: stripAnnotation(m[2].trim()), plugins: m[3].trim() })
      }
    }
  }
  if (!bundles.length) {
    console.error('[sync-sport] FATAL: could not parse any bundles from F06-BUNDLE-INVENTORY.md')
    process.exit(1)
  }
  return bundles
}

function parsePricing(md) {
  // F07's canonical table has columns: # | Tier | Monthly | Annual | Savings | Included | Access
  // Find any row where one cell is **Name** and another cell starts with $ or is $0.
  const tiers = []
  const lines = md.split('\n')
  for (const line of lines) {
    if (!line.trim().startsWith('|')) continue
    const cells = line.split('|').slice(1, -1).map((c) => c.trim())
    // Find the tier name cell: first cell wrapped in **...**
    const nameIdx = cells.findIndex((c) => /^\*\*[^*]+\*\*$/.test(c))
    if (nameIdx === -1) continue
    const tier = cells[nameIdx].replace(/\*\*/g, '').trim()
    // Monthly = first cell after name containing a $ or =="$0"
    const monthly = cells.slice(nameIdx + 1).find((c) => /^\$/.test(c) || c === '$0')
    // Annual = second such cell
    const remaining = cells.slice(nameIdx + 1).filter((c) => /^\$/.test(c) || c === '$0')
    const annual = remaining.length >= 2 ? remaining[1] : ''
    const includes = cells[cells.length - 2] || cells[cells.length - 1] || ''
    if (tier && monthly) {
      tiers.push({ tier, monthly, annual, includes })
    }
  }
  if (!tiers.length) {
    console.error('[sync-sport] FATAL: could not parse any tiers from F07-PRICING-TIERS.md')
    process.exit(1)
  }
  return tiers
}

function parsePluginList(md, label) {
  // Count rows in the first markdown table.
  const lines = md.split('\n')
  let inTable = false
  const plugins = []
  for (const line of lines) {
    if (/^\|.*\|.*\|.*\|/.test(line) && /name|plugin/i.test(line.split('|')[1] || '')) {
      inTable = true
      continue
    }
    if (inTable) {
      if (/^\|\s*---/.test(line)) continue
      if (!line.trim().startsWith('|')) {
        if (plugins.length) break
        continue
      }
      const cells = line.split('|').slice(1, -1).map((c) => c.trim())
      if (cells.length >= 1 && cells[0]) {
        const name = cells[0].replace(/\*\*/g, '').replace(/`/g, '').trim()
        if (name) plugins.push(name)
      }
    }
  }
  if (!plugins.length) {
    console.warn(`[sync-sport] WARN: 0 plugins parsed from ${label} — check markdown format`)
  }
  return plugins
}

// ----- Build -----

function buildPayload() {
  return {
    generatedAt: new Date().toISOString(),
    sources: { masterVersions: 'MASTER-VERSIONS.md', bundles: 'F06-BUNDLE-INVENTORY.md', pricing: 'F07-PRICING-TIERS.md', pluginsFree: 'F03-PLUGIN-INVENTORY-FREE.md', pluginsPro: 'F04-PLUGIN-INVENTORY-PRO.md' },
    versions: parseMasterVersions(readSource('MASTER-VERSIONS', sources.masterVersions)),
    bundles: parseBundles(readSource('F06-BUNDLE-INVENTORY', sources.bundles)),
    pricingTiers: parsePricing(readSource('F07-PRICING-TIERS', sources.pricing)),
    pluginsFree: parsePluginList(readSource('F03-PLUGIN-INVENTORY-FREE', sources.pluginsFree), 'F03'),
    pluginsPro: parsePluginList(readSource('F04-PLUGIN-INVENTORY-PRO', sources.pluginsPro), 'F04'),
  }
}

function stripTimestamp(payload) {
  const { generatedAt: _, ...rest } = payload
  return rest
}

function main() {
  const outDir = resolve(repoRoot, 'src/generated')
  const outFile = resolve(outDir, 'sport.json')
  const payload = buildPayload()

  if (CHECK_MODE) {
    if (!existsSync(outFile)) {
      console.error('[sync-sport] --check: src/generated/sport.json not found — run sync-sport without --check first.')
      process.exit(1)
    }
    const committed = JSON.parse(readFileSync(outFile, 'utf8'))
    const fresh = stripTimestamp(payload)
    const existing = stripTimestamp(committed)
    if (JSON.stringify(fresh) !== JSON.stringify(existing)) {
      console.error('[sync-sport] DRIFT DETECTED: src/generated/sport.json is stale vs SPORT sources.')
      console.error('[sync-sport] Run `pnpm sync-sport` and commit the updated sport.json before deploying.')
      process.exit(1)
    }
    console.log('[sync-sport] --check: sport.json is up-to-date.')
    return
  }

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
  writeFileSync(outFile, JSON.stringify(payload, null, 2) + '\n', 'utf8')
  console.log(`[sync-sport] wrote ${outFile} — ${payload.versions.length} versions, ${payload.bundles.length} bundles, ${payload.pricingTiers.length} tiers, ${payload.pluginsFree.length} free plugins, ${payload.pluginsPro.length} pro plugins.`)
}

main()
