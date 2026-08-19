# ɳTasks

Marketing site and 100% free hosted live ɳTasks app at `task.nself.org`.

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/nself-org/web)
[![License](https://img.shields.io/badge/license-Source--Available-green.svg)](../LICENSE)
[![Subdomain](https://img.shields.io/badge/serves-task.nself.org-purple.svg)](https://task.nself.org)
[![Coverage](https://img.shields.io/badge/coverage-vitest-brightgreen.svg)](./coverage/index.html)
<!-- VERSION_BADGE -->

## Description

**ɳTasks** at `task.nself.org` is both the marketing page and the 100% free hosted live
app for the open-source ɳTasks reference implementation. The reference app code is in the
[`task/` repo](https://github.com/nself-org/task) and is published on iOS and Android app
stores. This subapp hosts a free public instance backed by `web/backend` so anyone can try
ɳTasks without installing anything.

ɳTasks is the Type C reference example for any-stack development. It uses only free
plugins, never requires a license, and stays free forever. The hosted instance at
`task.nself.org` connects to the dog-fooded Hasura GraphQL endpoint at `api.nself.org`.

## Quick Start

```bash
cd web/task
pnpm install
pnpm dev
```

Open `http://localhost:3017`.

## Features

- Marketing landing page describing the ɳTasks reference app
- Hosted live app: full task management UI running against `web/backend`
- PWA install prompt (installable on iOS, Android, desktop)
- GraphQL subscriptions for real-time updates via `graphql-ws`
- Light and dark theme via `next-themes`
- App store download links to the native iOS and Android builds

## Installation

### Local development

```bash
cd web/task
pnpm install
pnpm dev
```

### Production

Auto-deploys to Vercel on push to `main`. Project is wired to the Vercel team
`unity-dev`. The hosted app reads from `api.nself.org` (Hasura) at runtime.

## Usage

```bash
pnpm dev
```

Runs the Next.js dev server on port 3017.

```bash
pnpm build
```

Builds the production bundle for Vercel.

```bash
pnpm test
```

Runs the Vitest suite.

## Architecture

Next.js 15 App Router on React 19 with Tailwind 4. Installable as a PWA via
`@ducanh2912/next-pwa`. Talks to `api.nself.org` (Hasura GraphQL) for queries, mutations,
and subscriptions. No paid plugins, no license gate. Anonymous users get a per-browser
identity scoped to a single device; signing in pairs the device to a `web/backend` Auth
account.

See [Architecture](https://github.com/nself-org/web) for the full Turborepo layout.

## Documentation

- [ɳTasks reference app](https://github.com/nself-org/task): native iOS and Android source.
- [Web Turborepo overview](../README.md)
- [docs.nself.org](https://docs.nself.org): full ɳSelf documentation.

## Contributing

See [CONTRIBUTING](https://github.com/nself-org/web): private-repo contribution flow.
The native ɳTasks app contributions go through the public `task/` repo.

## License

Source-Available, see [LICENSE](../LICENSE). The `task/` reference app it hosts is MIT.

## Related Repos

- [task](https://github.com/nself-org/task): the open-source ɳTasks reference app.
- [web/backend](../backend): the Hasura backend the hosted app talks to.
- [cli](https://github.com/nself-org/cli): the ɳSelf CLI that powers the backend.

---

Marketing site plus 100% free hosted live ɳTasks app. Free forever.
