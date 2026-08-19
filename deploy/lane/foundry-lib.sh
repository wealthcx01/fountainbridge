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
# Where a human decision is recorded (FB-044). Separate from the state ref: that one is engine
# bookkeeping the lane owns, this one is the audit record of what a person agreed to.
: "${APPROVALS_REF:=foundry-approvals}"
: "${API:=https://api.github.com}"
# This box serves ONE department's queue (FB-041 slice). FB-045 provisions the Sell/Scale boxes/repos.
: "${LANE_DEPARTMENT:=build}"

flog() { echo "[lane $(date -u +%FT%TZ)] $*" >&2; }

# bun-installed tools (gbrain, FB-050) live in ~/.bun/bin, which is NOT on the PATH systemd hands a
# unit. Without this the lane would never find the brain and would quietly research from files
# forever — the exact silent degradation #10 forbids.
#
# Every expansion here is default-guarded. This file is sourced under `set -u` by run-once.sh and
# supervisor.sh, and a system unit with no `User=` is not guaranteed a $HOME — a bare "$HOME" would
# abort the source and take the whole autonomous lane dark, which is precisely the failure PR #49
# fixed for the timer. A brain convenience line must never be able to cause it.
# Where the lane's own helper scripts live. Defined once, up here, because everything below resolves
# against it and this file is sourced under `set -u`.
LANE_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

LANE_BUN_BIN="${BUN_INSTALL:-${HOME:-/root}/.bun}/bin"
case ":${PATH:-}:" in
  *":$LANE_BUN_BIN:"*) ;;
  *) PATH="$LANE_BUN_BIN:${PATH:-}"; export PATH ;;
esac

gh_api() { curl -sS -H "Authorization: Bearer ${TICKET_GITHUB_TOKEN}" -H "Accept: application/vnd.github+json" \
                 -H "X-GitHub-Api-Version: 2022-11-28" "$@"; }

# The authenticated URL for the CURRENT department's repo.
#
# The stored `origin` is deliberately tokenless — a clone URL with credentials in it lands in
# .git/config in plaintext and in every `git remote -v` an operator runs — so every network git
# operation supplies the token here instead. A bare `git fetch origin` against a private repo fails
# with "could not read Username for 'https://github.com'", which is how this was found: the arca
# clone predated the token-stripping and still had credentials baked in, so Build worked and the two
# new departments did not.
origin_url() { printf 'https://x-access-token:%s@github.com/%s.git' "$TICKET_GITHUB_TOKEN" "$REPO"; }

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
  # FB-060: emit the bcap-contracts shape. The studio's reader has accepted BOTH since FB-042 —
  # reader first, deliberately, so this could change without a flag day and without going blind to
  # everything already on the ref. The lane vocabulary is written alongside, not instead: reports on
  # the ref today were written by the old shape, and the legacy half of `fromLaneRecord` is what
  # keeps them readable. Dropping either half is a separate decision, once those have aged out.
  # Single quotes are the point: this is a node program, not shell. The only `$` inside it is the
  # anchor in /\.\d+Z$/, and shell must not touch it. Values arrive as argv below, never by
  # interpolation — which is also what keeps a summary containing `$(…)` from being run.
  # shellcheck disable=SC2016
  local report; report=$(node -e '
    const [slug,status,summary,pr,started,repo,lane,trigger]=process.argv.slice(1);
    // The contract states an OUTCOME; the lane has always stated a status. Same mapping the studio
    // uses (lib/runreports.ts OUTCOME_OF_STATUS) — the two must not disagree about what a word means.
    const OUTCOME={idle:"no-useful-work",opened_pr:"opened-pr",blocked:"blocked",awaiting_founder:"awaiting-approval",failed:"error",progress:"progress"};
    const now=new Date().toISOString().replace(/\.\d+Z$/,"Z");
    // `working` is in flight: the contract says ended_at and outcome travel together, so a run that
    // has not finished states neither rather than half of a fact.
    const inFlight = status==="working";
    const outcome = inFlight ? null : (OUTCOME[status] ?? "blocked");
    const OWES=new Set(["blocked","error"]);
    process.stdout.write(JSON.stringify({
      lane_id:lane, started_at:started, ended_at:inFlight?null:now, trigger,
      outcome, summary_md:summary,
      tickets_touched: slug && slug!=="heartbeat" ? [slug] : [],
      error_detail: outcome && OWES.has(outcome) ? (summary||null) : null,
      pr_url: pr||null,
      // The lane vocabulary, kept so a report written today still reads on anything that has not
      // learned the contract shape yet. Removed once nothing depends on it.
      ticket:slug, lane, status, summary, started, finished:inFlight?undefined:now, repo,
    },null,2));
  ' "$slug" "$status" "$summary" "$pr_url" "$started" "$REPO" "${LANE_ID:-arca}" "${LANE_TRIGGER:-scheduled}")
  # The idle heartbeat overwrites ONE file (a liveness beacon), so frequent wakes don't flood the ref;
  # real ticket RunReports are timestamped history.
  local path
  if [ "$slug" = "heartbeat" ]; then path="runreports/_heartbeat.json"; else path="runreports/${slug}-$(date -u +%Y%m%dT%H%M%SZ).json"; fi
  local existing_sha; existing_sha=$(gh_api "$API/repos/$REPO/contents/$path?ref=$STATE_REF" | jval '.sha')
  local b64; b64=$(printf '%s' "$report" | base64 -w0)
  local body="{\"message\":\"runreport: $slug ($status)\",\"content\":\"$b64\",\"branch\":\"$STATE_REF\""
  [ -n "$existing_sha" ] && body="$body,\"sha\":\"$existing_sha\""
  body="$body}"
  # The write is CHECKED, and this is not theoretical caution. Until now the PUT sent its response to
  # /dev/null and the success line below printed unconditionally — so a rejected write (bad branch,
  # revoked token, protected ref) logged exactly like a good one. The lane's own liveness beacon could
  # have been dead for days while `journalctl` said "runreport →" every five minutes, and the founder
  # brief would simply have shown nothing with no way to tell "quiet" from "broken". That is the
  # failure mode CLAUDE.md #10 exists to forbid: a founder blocked at 22:00 must be able to see why.
  local resp; resp=$(gh_api -X PUT "$API/repos/$REPO/contents/$path" -d "$body")
  if printf '%s' "$resp" | grep -q '"content"'; then
    flog "runreport → $STATE_REF:$path ($status)"
  else
    # Loud, and specific enough to act on: which report, which ref, and what GitHub actually said.
    flog "RUNREPORT WRITE FAILED — $STATE_REF:$path ($status) — $(printf '%s' "$resp" | jval '.message')"
    return 1
  fi
}

# ---------------------------------------------------------------------------------------------------
# Departments (FB-045). One box serves every department of ONE venture: Build works the product repo,
# Sell works the marketing repo, Scale works the ops repo. Each has its own queue, its own base
# branch and its own gate.
# ---------------------------------------------------------------------------------------------------
#
# Configured as space-separated `id:owner/repo:base:gate` entries, so a new department is a line in
# lane.env and not a code change:
#
#   FOUNDRY_DEPARTMENTS="build:wealthcx01/arca:master:pr sell:wealthcx01/arca-marketing:main:activegraph"
#
# Unset → the single Build department this box ran before FB-045, built from REPO/BASE_BRANCH. An
# older lane.env therefore keeps working exactly as it did, rather than finding no departments and
# going quietly idle.
departments() {
  # Word-splitting is the point: the variable is a space-separated list of entries.
  # shellcheck disable=SC2086
  if [ -n "${FOUNDRY_DEPARTMENTS:-}" ]; then printf '%s\n' ${FOUNDRY_DEPARTMENTS}; return; fi
  printf '%s:%s:%s:%s\n' "${LANE_DEPARTMENT:-build}" "$REPO" "$BASE_BRANCH" "${LANE_GATE:-pr}"
}

# dept_field <entry> <1..4> — id | repo | base | gate. A malformed entry yields an empty gate, and
# every caller treats an unrecognised gate as the STRICTEST one rather than as `pr`.
dept_field() { printf '%s' "$1" | cut -d: -f"$2"; }

# The directory a department's repo is checked out in, derived from the repo name so two departments
# can never share a worktree (they hold different branches at the same moment).
dept_dir() { printf '%s/%s' "${LANE_HOME:-/opt/foundry/lane}" "$(printf '%s' "$1" | cut -d/ -f2)"; }

# ticket_gate <ticket-file> — the gate the TICKET declares (`**Gate:** pr|activegraph|...`), or empty.
#
# The ticket is the right place for this. A department's gate says what its risky work requires; only
# the ticket knows whether this particular piece of work IS risky, and a keyword scan of prose cannot
# tell. Empty means "not declared" — distinct from "declared pr" — so the caller can fall back.
ticket_gate() {
  grep -oiE '\*\*Gate:\*\*[[:space:]]*[A-Za-z0-9-]+' "$1" 2>/dev/null | head -1 \
    | sed -E 's/.*\*\*Gate:\*\*[[:space:]]*//I' | tr '[:upper:]' '[:lower:]'
}

# is_external_action <ticket-file> — would working this ticket reach someone outside the company?
#
# The ticket's own `**Gate:**` wins when it declares one. Only when it says nothing does this fall
# back to reading the prose, and the fallback stays generous.
#
# The generous fallback used to be the WHOLE rule, justified by "a false positive costs one approval
# click". That was wrong, and the first real Sell ticket proved it: SELL-001 writes a positioning
# document and mentions in passing that the landing page and the emails depend on it. The scan
# matched "emails", the lane was told to produce a send proposal for a ticket with no send, it
# correctly refused to fabricate one — and the supervisor would then have BLOCKED it for the
# omission. A false positive costs a blocked ticket, not a click.
#
# Neither direction can cause an unapproved send: the box holds no send credentials at all (§8). A
# false negative means a draft arrives as a PR with no approval card beside it — visible, and fixed
# by declaring the gate on the ticket.
is_external_action() {
  local declared; declared="$(ticket_gate "$1")"
  case "$declared" in
    pr) return 1 ;;          # the author says this one is ordinary work
    '') ;;                   # nothing declared → fall through to reading the prose
    *) return 0 ;;           # any non-pr gate → treat as an external action
  esac
  grep -qiE '\bsend(s|ing)?\b|\bemail(s|ing)?\b|\boutreach\b|\bcampaign\b|\bnewsletter\b|\bpublish(es|ing)?\b|\bbroadcast\b|\bsequence\b|\bmailshot\b|\bmailshots\b|\bpost (to|on) (twitter|x|linkedin|instagram)\b' "$1" 2>/dev/null
}

# write_proposal <approval-id> <normalised-proposal-json> — file an external action for the founder's
# approval, on the venture's `foundry-approvals` ref.
#
# The ref lives on the department's OWN repo, so the studio reads a Sell proposal where Sell's work
# is. Writing it is the last thing the lane does about that action: it holds no send credentials, and
# only a studio-issued grant lets the separate executor act (FB-044).
#
# The HTTP status is checked. `gh_api` is curl without --fail, so a 403/409/422 exits 0 with an error
# body — the failure mode FB-052 found on the PRP write, where the lane reported filing something it
# had never filed. Here that would mean telling a founder an action is waiting for them when nothing
# is.
write_proposal() {
  local id="$1" json="$2" path="approvals/$1/proposal.json"
  ensure_approvals_ref || { flog "could not ensure the approvals ref — proposal NOT filed"; return 1; }
  local existing_sha; existing_sha=$(gh_api "$API/repos/$REPO/contents/$path?ref=$APPROVALS_REF" | jval '.sha')
  local b64; b64=$(printf '%s' "$json" | base64 -w0)
  local body="{\"message\":\"propose: $id\",\"content\":\"$b64\",\"branch\":\"$APPROVALS_REF\""
  [ -n "$existing_sha" ] && body="$body,\"sha\":\"$existing_sha\""
  body="$body}"
  local code; code=$(gh_api -o /dev/null -w '%{http_code}' -X PUT "$API/repos/$REPO/contents/$path" -d "$body")
  case "$code" in
    200|201) flog "proposal → $APPROVALS_REF:$path (awaiting the founder)"; return 0 ;;
    *) flog "proposal write REFUSED by GitHub (HTTP $code) — nothing is waiting for the founder"; return 1 ;;
  esac
}

# Ensure the approvals ref exists on this repo. Same shape as ensure_state_ref, separate ref: the
# state ref is engine bookkeeping, this one is the audit record of things a human decided.
ensure_approvals_ref() {
  if ! gh_api "$API/repos/$REPO/git/ref/heads/$APPROVALS_REF" | grep -q '"ref"'; then
    local base_sha; base_sha=$(gh_api "$API/repos/$REPO/git/ref/heads/$BASE_BRANCH" | jval '.object.sha')
    [ -n "$base_sha" ] || return 1
    gh_api -X POST "$API/repos/$REPO/git/refs" -d "{\"ref\":\"refs/heads/$APPROVALS_REF\",\"sha\":\"$base_sha\"}" >/dev/null
    flog "created approvals ref $APPROVALS_REF"
  fi
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
# PRP — Product Requirement Prompt (FB-052). See docs/lane-rpiv-loop.md §PRP.
#
# The PLAN step writes one before any code exists: intent, context, tasks, and explicit VALIDATION
# GATES. These helpers are the supervisor's interface to it. The parsing itself lives in prp-lib.mjs
# (pure, unit-tested); bash only ever asks questions through prp-check.mjs.
# ---------------------------------------------------------------------------------------------------
: "${PRP_CHECK_BIN:=$LANE_LIB_DIR/prp-check.mjs}"

# prp_ok <file> — true if the document is a usable PRP (required sections + at least one gate).
prp_ok() { [ -s "$1" ] && node "$PRP_CHECK_BIN" validate "$1" >/dev/null 2>&1; }

# prp_problems <file> — plain-language reasons it is not a usable PRP (empty when it is).
# The `|| true` is load-bearing. This is only ever called when validation ALREADY failed, so the
# pipeline's first command exits non-zero by design — and supervisor.sh runs under `set -euo
# pipefail`, where `WHY="$(prp_problems …)"` would then kill the lane outright: no `blocked`
# RunReport, no log line, claim branch stranded. Reporting why a PRP is malformed must never be more
# fatal than the malformed PRP.
prp_problems() {
  [ -f "$PRP_CHECK_BIN" ] || { echo "the PRP checker isn't installed on this box"; return 0; }
  { { node "$PRP_CHECK_BIN" validate "$1" 2>&1 >/dev/null || true; } \
    | sed -E 's/^\[prp\] not a usable PRP: //' | head -1; } || true
}

# prp_gate_count <file> — how many validation gates it declares (0 on any error).
prp_gate_count() { node "$PRP_CHECK_BIN" validate "$1" 2>/dev/null || echo 0; }

# prp_dimension_note <file> — which of the four gate dimensions the PRP does NOT name, if any.
# The checker computes this and writes it to stderr; every other caller discards stderr, so without
# this it would be worked out and thrown away while the docs promise gates "covering four dimensions".
prp_dimension_note() {
  { node "$PRP_CHECK_BIN" validate "$1" 2>&1 >/dev/null || true; } | sed -nE 's/^\[prp\] note: //p' | head -1
}

# prp_gate_list <file> — the gates as "id<TAB>text" lines, for the checking prompt.
prp_gate_list() { node "$PRP_CHECK_BIN" gates "$1" 2>/dev/null || true; }

# prp_gate_report <file> <verdicts.json> [expected-gates] — founder-facing ✅/❌ list on stdout;
# non-zero if ANY gate failed or went unreported, if no gates could be read at all, or if the gate
# list no longer matches <expected-gates>. Unreported counts as failed: silence is not evidence.
prp_gate_report() { node "$PRP_CHECK_BIN" report "$1" "$2" "${3:-}" 2>/dev/null; }

# prp_gate_summary <file> <verdicts.json> [expected-gates] — the failures as one line for a RunReport.
prp_gate_summary() { node "$PRP_CHECK_BIN" summary "$1" "$2" "${3:-}" 2>/dev/null || true; }

# prp_path <slug> — where a PRP lives on the engine-state ref. One spelling, used everywhere.
prp_path() { printf 'prps/%s.md' "$1"; }

# ticket_fingerprint <ticket-file> — content hash of the ticket a PRP was written from.
ticket_fingerprint() { sha256sum "$1" 2>/dev/null | cut -c1-16; }

# write_prp <slug> <file> <ticket-file> — persist the PRP to the engine-state ref so it outlives this
# process. This is what makes Archon's "clear the chat, resume from the board" true here: the durable
# context is the ticket plus this file, never a session's history.
#
# The ticket's fingerprint goes in as a trailer. Without it a resumed PRP is bound to the slug alone,
# and run-once.sh's un-stick path — which exists precisely so a founder who EDITS a stuck ticket gets
# it retried — would hand the retry the plan and gates written from the OLD ticket text, silently
# ignoring the edit while the PR claimed it validated against them.
write_prp() {
  local slug="$1" file="$2" ticket="${3:-}" path
  path="$(prp_path "$slug")"
  [ -s "$file" ] || return 1
  ensure_state_ref || return 1

  local tmp; tmp="$(mktemp)"
  cat "$file" >"$tmp"
  [ -n "$ticket" ] && printf '\n<!-- foundry-ticket: %s -->\n' "$(ticket_fingerprint "$ticket")" >>"$tmp"

  local existing_sha; existing_sha=$(gh_api "$API/repos/$REPO/contents/$path?ref=$STATE_REF" | jval '.sha')
  local body; body=$(node -e '
    const [msg,content,branch,sha]=process.argv.slice(1);
    const o={message:msg,content,branch};
    if (sha) o.sha=sha;
    process.stdout.write(JSON.stringify(o));
  ' "prp: $slug" "$(base64 -w0 <"$tmp")" "$STATE_REF" "$existing_sha")
  rm -f "$tmp"

  # gh_api is `curl -sS` with no --fail, so a 409/403/422 would otherwise exit 0 and this would
  # report success for a file that was never written — leaving the PR body pointing at nothing and
  # the resume feature silently degraded to re-planning forever.
  local code
  code=$(gh_api -o /dev/null -w '%{http_code}' -X PUT "$API/repos/$REPO/contents/$path" -d "$body")
  case "$code" in
    200|201) flog "PRP → $STATE_REF:$path" ;;
    *) flog "could not persist the PRP (HTTP $code)"; return 1 ;;
  esac
}

# read_prp <slug> <dest> [ticket-file] — fetch a previously-written PRP. Non-zero when there isn't
# one (the normal first-run case) or when it was written from a DIFFERENT version of the ticket.
read_prp() {
  local slug="$1" dest="$2" ticket="${3:-}" content
  content=$(gh_api "$API/repos/$REPO/contents/$(prp_path "$slug")?ref=$STATE_REF" | jval '.content')
  [ -n "$content" ] || return 1
  printf '%s' "$content" | tr -d '\n' | base64 -d >"$dest" 2>/dev/null || return 1
  [ -s "$dest" ] || return 1

  if [ -n "$ticket" ]; then
    local stored want
    stored=$(sed -nE 's/^<!-- foundry-ticket: ([0-9a-f]+) -->$/\1/p' "$dest" | tail -1)
    want="$(ticket_fingerprint "$ticket")"
    if [ -z "$stored" ] || [ "$stored" != "$want" ]; then
      flog "the stored PRP was written from a different version of this ticket — re-planning"
      rm -f "$dest"
      return 1
    fi
  fi
}

# ---------------------------------------------------------------------------------------------------
# The venture brain (FB-050). See docs/venture-brain.md.
# ---------------------------------------------------------------------------------------------------
: "${BRAIN_QUERY_BIN:=$LANE_LIB_DIR/brain-query.mjs}"
: "${BRAIN_RESEARCH_TIMEOUT:=180}"

# brain_research <ticket-file> [department] — echo what the venture already knows about this ticket,
# retrieved SEMANTICALLY from the brain (deposited context/library, prior tickets, code) and
# partitioned to the lane's own department. Empty output + non-zero if the brain can't answer: the
# caller degrades to reading files, it never dies (a lane must not stop working because an index is
# down). Bounded by its own timeout so a wedged brain can't hold up the loop.
#
# BRAIN_RESEARCH_WHY is set to the reason it failed. brain-query.mjs writes a specific diagnosis to
# stderr ("gbrain query failed: …", "no relevant pages…") and exits 1 vs 3 to tell them apart —
# discarding that would make an unreachable brain, a wedged lock, a bad gbrain pin and a genuinely
# empty index all look identical in the log, the PR body and the RunReport (#10).
BRAIN_RESEARCH_WHY=""
brain_research() {
  local ticket="$1" dept="${2:-}"
  local args=(--ticket "$ticket") err rc
  BRAIN_RESEARCH_WHY=""
  if [ ! -f "$BRAIN_QUERY_BIN" ]; then BRAIN_RESEARCH_WHY="brain not installed on this box"; return 1; fi
  if ! command -v gbrain >/dev/null 2>&1; then BRAIN_RESEARCH_WHY="gbrain is not on the lane's PATH"; return 1; fi
  [ -n "$dept" ] && args+=(--department "$dept")

  err="$(mktemp)"
  set +e
  timeout "$BRAIN_RESEARCH_TIMEOUT" node "$BRAIN_QUERY_BIN" "${args[@]}" 2>"$err"
  rc=$?
  set -e
  if [ $rc -ne 0 ]; then
    BRAIN_RESEARCH_WHY="$(tr -d '\r' <"$err" | grep -v '^$' | tail -1 | sed -E 's/^\[brain\] //' | cut -c1-160)"
    [ $rc -eq 124 ] && BRAIN_RESEARCH_WHY="the brain took longer than ${BRAIN_RESEARCH_TIMEOUT}s to answer"
    [ -n "$BRAIN_RESEARCH_WHY" ] || BRAIN_RESEARCH_WHY="the brain returned no answer (exit $rc)"
    flog "brain research failed: $BRAIN_RESEARCH_WHY"
  fi
  rm -f "$err"
  return $rc
}
