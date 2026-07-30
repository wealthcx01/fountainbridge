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

# bun-installed tools (gbrain, FB-050) live in ~/.bun/bin, which is NOT on the PATH systemd hands a
# unit. Without this the lane would never find the brain and would quietly research from files
# forever — the exact silent degradation #10 forbids.
case ":$PATH:" in
  *":$HOME/.bun/bin:"*) ;;
  *) PATH="$HOME/.bun/bin:$PATH"; export PATH ;;
esac

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

# The tools a headless lane phase may use. We CANNOT use bypassPermissions — Claude Code refuses
# `--dangerously-skip-permissions` when running as root (the lane's systemd identity), so we grant an
# explicit allowlist under acceptEdits instead. This is safe: the box holds no send/deploy/payment creds
# (§8), so the boundary is the isolated box + the supervisor's gate, not the in-session permission mode.
: "${LANE_ALLOWED_TOOLS:=Bash Read Grep Glob Edit Write Task WebFetch WebSearch TodoWrite NotebookEdit}"

# claude_lane <timeout_secs> <prompt>
# Runs one headless Claude Code session with the auth ladder (Max preferred, API fallback) under
# acceptEdits + the lane allowlist. Prints the session's stdout; returns claude's exit code (124 on
# timeout). The caller inspects the output for a headless BLOCKED marker (see phase_blocked).
claude_lane() {
  local to="$1" prompt="$2"
  # shellcheck disable=SC2086  # LANE_ALLOWED_TOOLS is an intentional space-separated arg list
  if [ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
    env -u ANTHROPIC_API_KEY CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_CODE_OAUTH_TOKEN" \
      timeout "$to" claude -p "$prompt" --permission-mode acceptEdits --allowedTools $LANE_ALLOWED_TOOLS --output-format text
  else
    ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}" \
      timeout "$to" claude -p "$prompt" --permission-mode acceptEdits --allowedTools $LANE_ALLOWED_TOOLS --output-format text
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

# toolchain_probe <repo_dir> <logfile> — runs the venture's own toolchain ONCE and ECHOES one result
# line per step: "typecheck <rc>", "lint <rc>", "test <failing-count>" (0 = green). Full output → the
# logfile. Detects bun (bun.lock) vs npm. This is the raw objective signal; the GATE is the *regression*
# between the base branch and the lane's branch (venture_regression), because a venture can carry
# pre-existing debt (arca's typecheck/lint are red on master) — the lane must not be blocked by breakage
# it didn't cause, only by breakage it introduces.
: "${PROBE_TIMEOUT:=300}"   # per-step cap so a hanging venture command can't hang the lane
toolchain_probe() {
  local dir="$1" log="$2"; : >"$log"
  local run install testcmd to="timeout $PROBE_TIMEOUT"
  if [ -f "$dir/bun.lock" ] || [ -f "$dir/bun.lockb" ]; then run="bun run"; install="bun install --frozen-lockfile"; testcmd="bun test"
  elif [ -f "$dir/package-lock.json" ]; then run="npm run"; install="npm ci"; testcmd="npm test"
  else echo "toolchain none"; return 0; fi
  (
    cd "$dir" || exit 3
    export PATH="$HOME/.bun/bin:$PATH"
    has() { node -e 'const s=require("./package.json").scripts||{};process.exit(s[process.argv[1]]?0:1)' "$1" 2>/dev/null; }
    if [ ! -d node_modules ]; then eval "$to $install" >>"$log" 2>&1; fi
    if has typecheck; then eval "$to $run typecheck" >>"$log" 2>&1; echo "typecheck $?"; fi
    if has lint;      then eval "$to $run lint"      >>"$log" 2>&1; echo "lint $?"; fi
    eval "$to $testcmd" >>"$log" 2>&1; local trc=$?
    local fails; fails=$(grep -oE '[0-9]+ fail' "$log" | tail -1 | grep -oE '^[0-9]+' || true)
    if [ -z "$fails" ]; then if [ "$trc" -eq 0 ]; then fails=0; else fails=999; fi; fi
    echo "test $fails"
  )
}

# venture_regression <base_probe> <branch_probe> — echoes a plain-language reason if the lane's branch
# REGRESSED the toolchain vs the base (a step that passed now fails, or more failing tests); empty +
# return 0 if the branch is no worse than base. This is the HARD gate.
venture_regression() {
  local base="$1" branch="$2" step brc bx
  for step in typecheck lint; do
    brc=$(awk -v s="$step" '$1==s{print $2}' "$base"); bx=$(awk -v s="$step" '$1==s{print $2}' "$branch")
    # Only compare when we HAVE a baseline value — a missing baseline can't prove a regression, and
    # defaulting it to "was passing" would flag arca's pre-existing red as the lane's fault.
    if [ -n "$brc" ] && [ "$brc" = "0" ] && [ -n "$bx" ] && [ "$bx" != "0" ]; then
      echo "your change broke '$step' (was passing before)"; return 1
    fi
  done
  local bt xt; bt=$(awk '$1=="test"{print $2}' "$base"); xt=$(awk '$1=="test"{print $2}' "$branch")
  if [ -n "$bt" ] && [ -n "$xt" ] && [ "$xt" -gt "$bt" ] 2>/dev/null; then
    echo "your change added failing tests (${bt} → ${xt})"; return 1
  fi
  return 0
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

# ---------------------------------------------------------------------------------------------------
# The venture brain (FB-050). See docs/venture-brain.md.
# ---------------------------------------------------------------------------------------------------
LANE_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
: "${BRAIN_QUERY_BIN:=$LANE_LIB_DIR/brain-query.mjs}"
: "${BRAIN_RESEARCH_TIMEOUT:=180}"

# brain_research <ticket-file> [department] — echo what the venture already knows about this ticket,
# retrieved SEMANTICALLY from the brain (deposited context/library, prior tickets, code) and
# partitioned to the lane's own department. Empty output + non-zero if the brain can't answer: the
# caller degrades to reading files, it never dies (a lane must not stop working because an index is
# down). Bounded by its own timeout so a wedged brain can't hold up the loop.
brain_research() {
  local ticket="$1" dept="${2:-}"
  local args=(--ticket "$ticket")
  [ -f "$BRAIN_QUERY_BIN" ] || return 1
  command -v gbrain >/dev/null 2>&1 || return 1
  [ -n "$dept" ] && args+=(--department "$dept")
  timeout "$BRAIN_RESEARCH_TIMEOUT" node "$BRAIN_QUERY_BIN" "${args[@]}" 2>/dev/null
}
