# Monitoring

ɳTasks uses nSelf's built-in monitoring stack. No extra setup is needed.

For the full reference, see the [CLI Monitoring Guide](https://github.com/nself-org/cli/wiki/monitoring).

## ɳTasks-specific dashboards

When the monitoring stack is running, Grafana includes these ɳTasks panels:

- **Task throughput** — tasks created, completed, and deleted per minute
- **Queue depth** — pending tasks by priority and assignee
- **API latency** — p50/p95/p99 for the Hasura GraphQL endpoint
- **Active users** — unique users with activity in the last 5 minutes

## Enable

Monitoring is on by default. Verify with:

```bash
nself status --monitoring
```
