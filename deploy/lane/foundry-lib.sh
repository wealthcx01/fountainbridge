#!/usr/bin/env bash
# Foundry lane shared helpers. Sourced by supervisor.sh (works one ticket) and run-once.sh (the
# autonomous wrapper). Keeps the RunReport / GitHub / state-ref logic + the RPIV loop primitives
# (FB-041) in one place.
#
# Expects in the environment: REPO, BASE_BRANCH, TICKET_GITHUB_TOKEN. STATE_REF defaults to
# foundry-state (the direct-push engine-state ref — design §6). At least one Claude auth is required
# (CLAUDE_CODE_OAUTH_TOKEN = Max, preferred; or ANTHROPIC_API_KEY = fallback).
: "${REPO:=wealthcx01/arca}"
: "${BASE_BRANCH:=master}"
: "${STATE_REF:=foundry-state}"
: "${API:=https://api.github.com}"
# This box serves ONE department's queue (FB-041 slice). FB-045 provisions the Sell/Scale boxes/repos.
: "${LANE_DEPARTMENT:=build}"

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

# ---------------------------------------------------------------------------------------------------
# RPIV loop primitives (FB-041). See docs/lane-rpiv-loop.md.
# ---------------------------------------------------------------------------------------------------

# claude_lane <timeout_secs> <permission_mode> <prompt>
# Runs one headless Claude Code session with the auth ladder (Max preferred, API fallback). Prints the
# session's stdout; returns claude's exit code (124 on timeout). The caller inspects the output for a
# headless BLOCKED marker (see phase_blocked). No send/deploy creds exist on the box (§8), so
# bypassPermissions here is bounded to the repo working tree — which the gate controls.
claude_lane() {
  local to="$1" perm="$2" prompt="$3"
  if [ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
    env -u ANTHROPIC_API_KEY CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_CODE_OAUTH_TOKEN" \
      timeout "$to" claude -p "$prompt" --permission-mode "$perm" --output-format text
  else
    ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}" \
      timeout "$to" claude -p "$prompt" --permission-mode "$perm" --output-format text
  fi
}

# phase_blocked <logfile> — true if a gstack skill ended headless-BLOCKED (needs a human decision).
# Those runs exit 0 but print the marker, so grep for it rather than trust the exit code.
phase_blocked() { grep -qiE 'BLOCKED[[:space:]]*[-—][[:space:]]*AskUserQuestion' "$1" 2>/dev/null; }

# ticket_department <ticket-file> — the ticket's declared department, lowercased; default "build".
# A bash-side grep with a documented default (NOT a bcap-contracts field yet — adversarial review P2).
ticket_department() {
  local d; d=$(grep -oiE '\*\*Department:\*\*[[:space:]]*[A-Za-z]+' "$1" 2>/dev/null | head -1 \
    | sed -E 's/.*\*\*Department:\*\*[[:space:]]*//I' | tr '[:upper:]' '[:lower:]')
  case "$d" in build|sell|scale) echo "$d" ;; *) echo "build" ;; esac
}

# venture_gate <repo_dir> <rundir> — the HARD objective floor: install + typecheck + lint + test on the
# venture's own toolchain, gating on EXIT CODES (unfakeable). Detects bun (bun.lock) vs npm. Echoes a
# one-line summary of the first failing step (empty on success); returns non-zero on any failure.
venture_gate() {
  local dir="$1" log="$2/tests.log"; : >"$log"
  ( cd "$dir" || exit 3
    if [ -f bun.lock ] || [ -f bun.lockb ]; then RUN="bun run"; INSTALL="bun install --frozen-lockfile"; TEST="bun test";
    elif [ -f package-lock.json ]; then RUN="npm run"; INSTALL="npm ci"; TEST="npm test";
    else echo "NO_TOOLCHAIN"; exit 0; fi
    has() { node -e 'const s=require("./package.json").scripts||{};process.exit(s[process.argv[1]]?0:1)' "$1" 2>/dev/null; }
    if [ ! -d node_modules ]; then echo "+ $INSTALL"; $INSTALL || { echo "FAIL: install"; exit 1; }; fi
    if has typecheck; then echo "+ $RUN typecheck"; $RUN typecheck || { echo "FAIL: typecheck"; exit 1; }; fi
    if has lint;      then echo "+ $RUN lint";      $RUN lint      || { echo "FAIL: lint";      exit 1; }; fi
    echo "+ $TEST"; $TEST || { echo "FAIL: test"; exit 1; }
    echo "OK"
  ) >>"$log" 2>&1
  local rc=$?
  if [ $rc -ne 0 ]; then grep -m1 '^FAIL:' "$log" | sed 's/^FAIL: /tests failed at: /'; fi
  return $rc
}

# review_status <repo_dir> — reads gstack's OWN review artifact for the current repo+branch and echoes
# "<status> <critical>" from the latest entry (e.g. "SHIP 0"), or "NONE" if /review logged nothing.
# This is the objective binding (adversarial review P0-3): gstack-review-log's structured record, not a
# model-authored boolean.
review_status() {
  local dir="$1" out
  out=$( cd "$dir" && ~/.claude/skills/gstack/bin/gstack-review-read 2>/dev/null || echo NO_REVIEWS )
  printf '%s' "$out" | node -e '
    let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
      const jsonl=d.split("---CONFIG---")[0].trim().split("\n").filter(Boolean);
      if(!jsonl.length||d.startsWith("NO_REVIEWS")){process.stdout.write("NONE");return;}
      try{const last=JSON.parse(jsonl[jsonl.length-1]);
        process.stdout.write((last.status||"UNKNOWN")+" "+(last.critical??0));}
      catch{process.stdout.write("NONE");}
    })'
}

# mem_available_mb — free-to-allocate memory in MB (for the /qa pre-flight RAM check).
mem_available_mb() { awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo 2>/dev/null || echo 0; }
