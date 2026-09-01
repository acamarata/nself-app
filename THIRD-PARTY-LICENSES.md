# Third-party licenses

ɳTask itself is MIT. Some dependencies are distributed under other licenses.
This file records the ones that are not permissive, so that the MIT grant on
this repository's own source is not mistaken for a claim about them.

## Mozilla Public License 2.0

MPL-2.0 is file-level copyleft. Section 3.3 permits distributing a Larger Work
under a different license, provided the MPL-covered files themselves remain
under MPL-2.0. These dependencies are used unmodified, so their license applies
to them and not to this repository's source.

### Reachable at runtime

Used by `@nself-web/og` and executed by `web/api/og.ts`, a Vercel Edge Function
that renders Open Graph images per request:

| Package | Version | License |
|---|---|---|
| `satori` | 0.0.46 | MPL-2.0 |
| `@resvg/resvg-wasm` | 2.0.0-alpha.4 | MPL-2.0 |
| `@vercel/og` | 1.0.0 | MPL-2.0 |

### Build and development only

Not shipped and not executing at request time:

| Package | Used by | License |
|---|---|---|
| `lightningcss` | `@tailwindcss/postcss`, Expo/Metro toolchain | MPL-2.0 |
| `axe-core` | `jest-axe`, `@storybook/addon-a11y` | MPL-2.0 |
| `@edge-runtime/*`, `edge-runtime` | `@vercel/node` (devDependency) | MPL-2.0 |

## Everything else

A full scan of 1,628 packages across all six workspace apps, the Rust/Cargo
manifests for the Tauri desktop app, and all sixteen internal `@nself/*` and
`@nself-web/*` packages found only MIT, Apache-2.0, BSD and ISC. No GPL, AGPL,
LGPL, SSPL, CC-BY-SA, BUSL, Elastic or proprietary licenses are present in any
dependency path.

To regenerate this list, re-run the dependency license scan before changing the
license of this repository. A permissive license claim is only valid if the
dependency graph supports it.
