#!/usr/bin/env npx tsx
/**
 * check-i18n-completeness.ts
 *
 * Purpose: Verify that all i18n locale files have at least every key present in
 *          the English (en) baseline. Runs across mobile (apps/mobile) and web
 *          (web/ntask — via ../web/ntask) surfaces. TV surface is checked when
 *          i18n files exist (skipped with a notice when not yet wired).
 *
 * Inputs:  Locale JSON files under each surface's i18n directory.
 * Outputs: Stdout report; exits 0 on success, 1 on any missing key.
 *
 * Usage:
 *   pnpm i18n:check              (from ntask root, via package.json script)
 *   npx tsx scripts/check-i18n-completeness.ts
 *
 * Constraints:
 *   - Only checks top-level key presence, not translation quality.
 *   - Extra keys in a locale (beyond en) are allowed.
 *   - Missing i18n directories for a surface are skipped with a warning
 *     (TV placeholder may not exist yet).
 *   - Nested objects are flattened with dot-path keys for the diff.
 *
 * SPORT: N-S3-T3 translation completeness CI gate
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NTASK_ROOT = path.resolve(__dirname, '..');

// ── Surface definitions ─────────────────────────────────────────────────────

interface Surface {
  name: string;
  i18nDir: string;
}

const SURFACES: Surface[] = [
  {
    name: 'mobile',
    i18nDir: path.join(NTASK_ROOT, 'apps/mobile/src/i18n'),
  },
  {
    name: 'web',
    // web/ntask lives one level up from ntask root
    i18nDir: path.join(NTASK_ROOT, '../web/ntask/src/i18n'),
  },
  {
    name: 'tv',
    i18nDir: path.join(NTASK_ROOT, 'apps/tv/src/i18n'),
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Recursively flatten nested objects to dot-keyed paths. */
function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const dotKey = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as Record<string, unknown>, dotKey));
    } else {
      keys.push(dotKey);
    }
  }
  return keys;
}

function readJson(filePath: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function listDirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) =>
    fs.statSync(path.join(dir, f)).isDirectory(),
  );
}

function listJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''));
}

// ── Main ─────────────────────────────────────────────────────────────────────

let totalErrors = 0;
let totalWarnings = 0;

for (const surface of SURFACES) {
  const { name, i18nDir } = surface;

  if (!fs.existsSync(i18nDir)) {
    console.warn(`[SKIP] ${name}: i18n directory not found at ${i18nDir} — surface not yet wired`);
    totalWarnings++;
    continue;
  }

  const locales = listDirs(i18nDir);
  if (!locales.includes('en')) {
    console.warn(`[SKIP] ${name}: no 'en' baseline directory found in ${i18nDir}`);
    totalWarnings++;
    continue;
  }

  const namespaces = listJsonFiles(path.join(i18nDir, 'en'));
  const targetLocales = locales.filter((l) => l !== 'en');

  console.log(`\n[${name}] Checking ${targetLocales.length} locales × ${namespaces.length} namespaces`);

  let surfaceErrors = 0;

  for (const ns of namespaces) {
    const enPath = path.join(i18nDir, 'en', `${ns}.json`);
    const enData = readJson(enPath);
    if (!enData) {
      console.warn(`  [WARN] ${name}/en/${ns}.json is missing or invalid`);
      continue;
    }
    const enKeys = new Set(flattenKeys(enData));

    for (const locale of targetLocales) {
      const localePath = path.join(i18nDir, locale, `${ns}.json`);

      if (!fs.existsSync(localePath)) {
        console.error(`  [FAIL] ${name}/${locale}/${ns}.json MISSING`);
        surfaceErrors++;
        totalErrors++;
        continue;
      }

      const localeData = readJson(localePath);
      if (!localeData) {
        console.error(`  [FAIL] ${name}/${locale}/${ns}.json is invalid JSON`);
        surfaceErrors++;
        totalErrors++;
        continue;
      }

      const localeKeys = new Set(flattenKeys(localeData));
      const missing = [...enKeys].filter((k) => !localeKeys.has(k));

      if (missing.length > 0) {
        console.error(`  [FAIL] ${name}/${locale}/${ns}: ${missing.length} missing key(s):`);
        for (const k of missing) {
          console.error(`         • ${k}`);
        }
        surfaceErrors++;
        totalErrors++;
      } else {
        console.log(`  [OK]   ${name}/${locale}/${ns} — all ${enKeys.size} key(s) present`);
      }
    }
  }

  if (surfaceErrors === 0) {
    console.log(`  ✓ ${name}: all locale files complete`);
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────

console.log('\n─────────────────────────────────────────');
if (totalErrors > 0) {
  console.error(`FAIL: ${totalErrors} i18n completeness error(s) found${totalWarnings > 0 ? `, ${totalWarnings} surface(s) skipped` : ''}.`);
  process.exit(1);
} else {
  console.log(`PASS: All checked locales have all English keys.${totalWarnings > 0 ? ` (${totalWarnings} surface(s) skipped — not yet wired)` : ''}`);
  process.exit(0);
}
