/**
 * vite.config.ts — ntask Vite SPA configuration
 *
 * Purpose:    Vite + React SPA for task.nself.org (Next.js → Vite migration)
 * Inputs:     none
 * Outputs:    dist/ (client bundle); api/ served by Vercel Functions at runtime
 * Constraints: SPA (no SSR); React Router for client routing; Tailwind v4 via PostCSS
 * SOT:        T-P3-E3-W2-S5 — web/ntask Next.js → Vite SPA migration
 * SPORT:      D-S8-T1
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'url'
import { resolve } from 'path'

// Shared packages live in the sibling nself-org/packages checkout, the same
// path pnpm-workspace.yaml resolves them from.
const PACKAGES_ROOT = resolve(__dirname, '../packages/@nself')
const WEB_PACKAGES_ROOT = resolve(__dirname, '../packages/@nself-web')

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Reference existing manifest.json rather than generating a new one
      manifest: false,
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // GraphQL API - stale while revalidate (with offline queue backing mutations)
            urlPattern: /^https?:\/\/.*\/api\/graphql/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'graphql-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
          {
            // Auth endpoints - always network (never cache stale auth data)
            urlPattern: /^https?:\/\/.*\/api\/auth\//,
            handler: 'NetworkOnly',
          },
          {
            // Static assets - cache first
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: { maxEntries: 100, maxAgeSeconds: 86400 * 30 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    // Use array form so sub-path aliases (more specific) are matched before
    // their parent package alias. Object form has no guaranteed key order.
    dedupe: ['react', 'react-dom'],
    alias: [
      // Same reason as vitest: @nself-web/ui is aliased to source, so its own
      // react / react-dom / next-themes imports would resolve from the sibling
      // checkout and produce a second React instance. dedupe does not reach
      // outside the project root.
      { find: /^react$/, replacement: resolve(__dirname, '../node_modules/react') },
      { find: /^react-dom$/, replacement: resolve(__dirname, '../node_modules/react-dom') },
      { find: /^next-themes$/, replacement: resolve(__dirname, '../node_modules/next-themes') },
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      // Sub-path aliases MUST come before the main package alias
      { find: '@nself/offline-queue/adapters/idb', replacement: resolve(PACKAGES_ROOT, 'offline-queue/src/adapters/idb.ts') },
      { find: '@nself/offline-queue/adapters/memory', replacement: resolve(PACKAGES_ROOT, 'offline-queue/src/adapters/memory.ts') },
      // Main package aliases
      { find: '@nself/ntask-core', replacement: resolve(PACKAGES_ROOT, 'ntask-core/src/index.ts') },
      { find: '@nself/offline-queue', replacement: resolve(PACKAGES_ROOT, 'offline-queue/src/index.ts') },
      { find: '@nself/auth-core', replacement: resolve(PACKAGES_ROOT, 'auth-core/src/index.ts') },
      { find: '@nself/graphql-client', replacement: resolve(PACKAGES_ROOT, 'graphql-client/src/index.ts') },
      { find: '@nself/i18n', replacement: resolve(PACKAGES_ROOT, 'i18n/src/index.ts') },
      { find: '@nself/observability', replacement: resolve(PACKAGES_ROOT, 'observability/src/index.ts') },
      // Point @nself-web/ui at its TypeScript source so Vite bundles it directly
      { find: '@nself-web/ui', replacement: resolve(WEB_PACKAGES_ROOT, 'ui/src/index.ts') },
      // @nself/tauri-bridge alias removed — src/lib/tauri.ts is now self-contained
      // and uses dynamic imports for @tauri-apps/* (browser-safe, no build-time dep).
    ],
  },
  server: {
    port: 3017,
    watch: {
      // Playwright (test-results/, playwright-report/) and Vitest coverage
      // (coverage/) write large trees of generated files on every test run.
      // Without excluding them, Vite's fs watcher treats each write as a
      // source change and fires a full-app HMR cascade (every page component
      // re-registers), which can starve the dev server long enough to make
      // in-flight page navigations time out mid-run.
      ignored: ['**/test-results/**', '**/playwright-report/**', '**/coverage/**'],
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Target modern browsers. @nself-web/ui ships ESNext syntax; esbuild can't
    // downgrade certain destructuring patterns to ES2020 browser targets.
    target: 'esnext',
    rollupOptions: {
      // src/lib/tauri.ts dynamically imports these desktop-only Tauri plugins
      // behind isTauri() guards. They are NOT installed in the web workspace
      // (only @tauri-apps/api is) — Rollup must not try to resolve/bundle
      // them for the browser build; the desktop shell (apps/desktop) supplies
      // them at runtime inside the Tauri webview.
      external: ['@tauri-apps/plugin-updater', '@tauri-apps/plugin-opener'],
    },
  },
})
