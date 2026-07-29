#!/usr/bin/env bash
# Foundry lane shared helpers (FB-040). Sourced by supervisor.sh (works one ticket) and run-once.sh
# (the autonomous wrapper). Keeps the RunReport / GitHub / state-ref logic in one place.
#
# Expects in the environment: REPO, BASE_BRANCH, TICKET_GITHUB_TOKEN. STATE_REF defaults to
# foundry-state (the direct-push engine-state ref — design §6).
: "${REPO:=wealthcx01/arca}"
: "${BASE_BRANCH:=master}"
: "${STATE_REF:=foundry-state}"
: "${API:=https://api.github.com}"

flog() { echo "[lane $(date -u +%FT%TZ)] $*" >&2; }

gh_api() { curl -sS -H "Authorization: Bearer ${TICKET_GITHUB_TOKEN}" -H "Accept: application/vnd.github+json" \
                 -H "X-GitHub-Api-Version: 2022-11-28" "$@"; }

# Extract a value from JSON on stdin via a JS accessor, e.g. jval '.object.sha'. Empty on miss.
jval() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{process.stdout.write(String(eval('JSON.parse(d)'+process.argv[1])??''))}catch{process.stdout.write('')}})" "$1"; }

# Ensure the engine-state ref exists (point it at base on first use). Idempotent.
ensure_state_ref() {
  if ! gh_api "$API/repos/$REPO/git/ref/heads/$STATE_REF" | grep -q '"ref"'; then
    local base_sha; base_sha=$(gh_api "$API/repos/$REPO/git/ref/heads/$BASE_BRANCH" | jval '.object.sha')
    [ -n "$base_sha" ] || return 1
    gh_api -X POST "$API/repos/$REPO/git/refs" -d "{\"ref\":\"refs/heads/$STATE_REF\",\"sha\":\"$base_sha\"}" >/dev/null
    flog "created state ref $STATE_REF"
  fi
}

# write_runreport <slug> <status> <summary> [pr_url] [started]
# Writes a RunReport JSON to the foundry-state ref (studio-readable). status ∈
# working|opened_pr|blocked|failed|idle|awaiting_founder.
write_runreport() {
  local slug="$1" status="$2" summary="$3" pr_url="${4:-}" started="${5:-$(date -u +%FT%TZ)}"
  ensure_state_ref || { flog "could not ensure state ref — report not written"; return 1; }
  local report; report=$(node -e '
    const [slug,status,summary,pr,started,repo,lane]=process.argv.slice(1);
    process.stdout.write(JSON.stringify({ticket:slug,lane,status,summary,pr_url:pr||undefined,started,finished:new Date().toISOString().replace(/\.\d+Z$/,"Z"),repo},null,2));
  ' "$slug" "$status" "$summary" "$pr_url" "$started" "$REPO" "${LANE_ID:-arca}")
  # The idle heartbeat overwrites ONE file (a liveness beacon), so frequent wakes don't flood the ref;
  # real ticket RunReports are timestamped history.
  local path
  if [ "$slug" = "heartbeat" ]; then path="runreports/_heartbeat.json"; else path="runreports/${slug}-$(date -u +%Y%m%dT%H%M%SZ).json"; fi
  local existing_sha; existing_sha=$(gh_api "$API/repos/$REPO/contents/$path?ref=$STATE_REF" | jval '.sha')
  local b64; b64=$(printf '%s' "$report" | base64 -w0)
  local body="{\"message\":\"runreport: $slug ($status)\",\"content\":\"$b64\",\"branch\":\"$STATE_REF\""
  [ -n "$existing_sha" ] && body="$body,\"sha\":\"$existing_sha\""
  body="$body}"
  gh_api -X PUT "$API/repos/$REPO/contents/$path" -d "$body" >/dev/null
  flog "runreport → $STATE_REF:$path ($status)"
}
