# ɳTasks

**ɳTasks** is a free, open-source, self-hostable task manager. MIT licensed, no paid tiers, no pro plugins. Version 1.3.0.

Create lists, add tasks with due dates and tags, share lists with other people, and see changes from collaborators in real time. It runs on the web, on desktop (macOS, Windows, Linux), on mobile (iOS, Android), and on TV (Apple TV, Android TV).

## Three ways to use it

1. **Hosted SaaS**: go to [task.nself.org](https://task.nself.org), sign up, start using it. No setup, nothing to run.
2. **Self-host**: run the backend yourself with the nSelf CLI (`cd backend && make up`), then point any app surface at your own server. You own the data. See [[Self-Hosting]].
3. **Native apps**: web (React + Vite), desktop (Tauri 2), mobile (React Native + Expo), and TV (react-native-tvos) all talk to the same GraphQL backend. See [[Apps]] for what's shipped on each surface today.

## Start here

| Page | What it covers |
|---|---|
| [[Getting-Started]] | Prerequisites and your first run, hosted or self-hosted |
| [[Self-Hosting]] | Running your own backend: setup, env vars, migrations, backups |
| [[Features]] | The full list of what ɳTasks actually does today |
| [[Apps]] | Web, desktop, mobile, and TV: what's shipped vs. in progress |

## Everything else

- [[Quickstart-Guide]]: shorter version of Getting Started for experienced devs
- [[RN-Setup]] / [[Web-SPA]] / [[Desktop]] / [[TV]]: per-surface setup detail
- [[Backend-Setup]] / [[Backend-Architecture]] / [[Backend-Troubleshooting]]: backend detail
- [[Database-Schema]]: table reference
- [[Deployment]]: staging and production deploy
- [[Security]]: security practices
- [[CLI]] / [[MCP-Server]]: terminal CLI and the MCP server for AI agents
- [[Contributing]] / [[Changelog]]: contributor guide and version history

## Resources

- **GitHub:** [nself-org/ntask](https://github.com/nself-org/ntask)
- **Issues:** [Report a bug](https://github.com/nself-org/ntask/issues)
- **Discussions:** [Q&A](https://github.com/nself-org/ntask/discussions)
- **License:** [MIT](https://github.com/nself-org/ntask/blob/main/LICENSE)
- **Hosted app:** [task.nself.org](https://task.nself.org)
- **Ecosystem docs:** [docs.nself.org](https://docs.nself.org)
