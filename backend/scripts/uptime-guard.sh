#!/usr/bin/env bash
# uptime-guard.sh — watch the public ɳTask endpoints and file an nSentry report
# when one stops answering.
#
# Why this exists:
#   Nothing watched api.task.nself.org or auth.task.nself.org. The 2026-08-24
#   review caught a single transient 500 on /healthz by hand and could only note
#   that no monitor would have seen it. This box runs no Prometheus (grafana and
#   alertmanager are present, the scraper is not), so rather than stand one up —
#   the two-server rule forbids new boxes and this needs none — it uses the path
#   that already carries alerts off this machine: a report in
#   /opt/nself-ops/errors, which nself-sentry-sync delivers to each developer's
#   .claude/inbox. Same convention, same escalating backoff, as disk-guard.sh.
#
# Inputs:  UPTIME_TARGETS (space-separated "name=url"), REPORT_DIR, STATE_DIR.
# Outputs: a markdown report per newly failing target; nothing while healthy.
#
# Constraints:
#   - A single blip must not page anyone: a target has to fail FAIL_THRESHOLD
#     consecutive checks before a report is written.
#   - Repeat reports back off (30m, then 2h, then 6h, then 24h) so an outage
#     that lasts a day does not produce 288 files.
#   - Recovery is reported once, so the inbox shows the end of an incident.
set -euo pipefail

REPORT_DIR="${REPORT_DIR:-/opt/nself-ops/errors}"
STATE_DIR="${STATE_DIR:-/var/lib/nself-ops}"
FAIL_THRESHOLD="${UPTIME_FAIL_THRESHOLD:-3}"
BASE_TTL="${UPTIME_BASE_TTL:-1800}"
TIMEOUT="${UPTIME_TIMEOUT:-10}"
TARGETS="${UPTIME_TARGETS:-api=https://api.task.nself.org/healthz auth=https://auth.task.nself.org/healthz web=https://task.nself.org/}"

mkdir -p "$REPORT_DIR" "$STATE_DIR"

esc_ttl() { local b=$1 n=$2
  if   [ "$n" -le 1 ]; then echo "$b"
  elif [ "$n" -le 3 ]; then echo $((b * 4))
  elif [ "$n" -le 5 ]; then echo $((b * 12))
  else echo $((b * 48)); fi; }

emit() {
  local name=$1 url=$2 code=$3 sev=$4 kind=$5 ts f
  ts=$(date -u +%Y%m%d-%H%M%S)
  f="$REPORT_DIR/${ts}-$(printf %s "$name$ts" | md5sum | cut -c1-6)-uptime-${name}.md"
  {
    echo "---"
    echo "id: uptime:${name}:${ts}"
    echo "created_at: $(date -u +%FT%TZ)"
    if [ "$kind" = recovered ]; then
      echo "title: \"RECOVERED: ${url} is answering again\""
    else
      echo "title: \"${url} is not answering (HTTP ${code})\""
    fi
    echo "severity: ${sev}"
    echo "source: uptime-guard-$(hostname)"
    echo "---"
    echo
    if [ "$kind" = recovered ]; then
      echo "# Recovered: ${url}"
      echo
      echo "Answering again as of $(date -u +%FT%TZ)."
    else
      echo "# ${url} is not answering"
      echo
      echo "- HTTP status: \`${code}\` (0 means the request did not complete)"
      echo "- Checked from: $(hostname) every 5 minutes"
      echo "- Reported after ${FAIL_THRESHOLD} consecutive failures"
      echo
      echo "First checks to run:"
      echo '```bash'
      echo "docker ps --filter name=ntask --format '{{.Names}}\t{{.Status}}'"
      echo "docker logs --tail 50 ntask_nginx"
      echo "df -h /                     # 2026-08-14: a full disk took Postgres down"
      echo '```'
    fi
  } > "$f"
}

for target in $TARGETS; do
  name="${target%%=*}"; url="${target#*=}"
  state="$STATE_DIR/uptime-$name.state"
  reported="$STATE_DIR/uptime-$name.reported"

  # curl prints 000 AND exits non-zero when the request never completes, so a
  # `|| echo 000` fallback concatenates onto its output and yields "000000".
  code=$(curl -s -o /dev/null -m "$TIMEOUT" -w '%{http_code}' "$url") || true
  case "$code" in ''|*[!0-9]*) code=000 ;; esac

  if [ "$code" -ge 200 ] && [ "$code" -lt 400 ]; then
    if [ -f "$reported" ]; then
      emit "$name" "$url" "$code" info recovered
      rm -f "$reported"
    fi
    : > "$state"
    continue
  fi

  fails=$(cat "$state" 2>/dev/null || echo 0)
  [ -n "$fails" ] || fails=0
  fails=$((fails + 1))
  echo "$fails" > "$state"
  [ "$fails" -ge "$FAIL_THRESHOLD" ] || continue

  count=0; last=0
  [ -f "$reported" ] && read -r last count < "$reported" 2>/dev/null || true
  [ -n "${count:-}" ] || count=0
  ttl=$(esc_ttl "$BASE_TTL" "$count")
  if [ "$last" -eq 0 ] || [ $(( $(date +%s) - last )) -ge "$ttl" ]; then
    emit "$name" "$url" "$code" high down
    printf '%s %s\n' "$(date +%s)" "$((count + 1))" > "$reported"
  fi
done
