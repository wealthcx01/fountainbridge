#!/usr/bin/env bash
# Foundry autonomous lane wake (FB-040, extended by FB-041). ONE pass, called by the systemd timer:
#   budget check → scan for a workable ticket → "useful work?" (idle heartbeat if none) →
#   stale-claim reclaim → circuit-breaker → blast-radius routing → run the RPIV lane full-auto,
#   OR stop-at-PLAN for a sensitive ticket (produce a read-only plan for the founder, then wait).
#
# Safety: only Status `Todo`/`Ready` tickets are auto-worked (a real backlog of Planned/Shipped
# tickets is never touched); sensitive tickets (auth/payments/sends/migrations/secrets) never
# auto-open a PR; a per-day wake budget + per-ticket attempt cap bound the spend. The box holds no
# send/deploy creds, so the lane can never send or deploy regardless (§8).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/lane/foundry-lib.sh
. "$SCRIPT_DIR/foundry-lib.sh"

: "${REPO_DIR:=/opt/foundry/lane/arca}"
: "${TICKET_GITHUB_TOKEN:?need a repo-write token (lane identity)}"
if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "need Claude auth: set CLAUDE_CODE_OAUTH_TOKEN (Max, preferred) or ANTHROPIC_API_KEY" >&2; exit 1
fi
# A wake runs the whole RPIV loop, so it is many agentic sessions, not one. Since FB-052 the worst
# case is: up to 2 PLAN attempts + MAX_VALIDATION_ROUNDS × (implement + gate-check + review + qa) —
# about 10 sessions at the default of 2 rounds, against a shared Claude Max. The budget counts WAKES,
# not sessions, so it bounds how many tickets get worked per day rather than the spend within one.
# Lower MAX_VALIDATION_ROUNDS (supervisor.sh) if that ceiling matters more than the repair attempt.
: "${DAILY_WAKE_BUDGET:=8}"
: "${MAX_ATTEMPTS:=3}"          # per-ticket circuit breaker
: "${PLAN_TIMEOUT:=600}"
STATE_DIR="${STATE_DIR:-/opt/foundry/lane/state}"; mkdir -p "$STATE_DIR"
SUP="$SCRIPT_DIR/supervisor.sh"

# --- one wake at a time on this box ------------------------------------------------------------------
# A wake now takes as long as the RPIV loop takes — plan, implement, validate, repair, review, qa —
# which is routinely longer than the five minutes between timer firings. Without this, the timer
# starts a second wake on top of the first.
#
# The claim (a branch-create CAS) does not prevent it, because the second wake reads the first's
# claim branch, sees no open PR behind it, and cannot tell "a run is working on this right now" from
# "a run died and left this behind" — so it does exactly what it was built to do and reclaims the
# orphan. Observed live: two supervisors on SELL-001, each burning its own Claude sessions, racing
# on one branch.
#
# One box serves one venture (D1), so a box-local lock is the whole answer. Non-blocking on purpose:
# a wake that arrives while another is running should step aside, not queue up behind it and start
# the moment it finishes.
LOCK_FILE="$STATE_DIR/.wake.lock"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  flog "another wake is still running on this box — stepping aside"
  exit 0
fi

DAY=$(date -u +%F); BUDGET_FILE="$STATE_DIR/wakes-$DAY"
runs_today() { if [ -f "$BUDGET_FILE" ]; then wc -l < "$BUDGET_FILE" | tr -d ' '; else echo 0; fi; }
attempts_of() { if [ -f "$STATE_DIR/attempts-$1" ]; then cat "$STATE_DIR/attempts-$1"; else echo 0; fi; }

# Read a ticket's Status field (lowercased first word), e.g. "todo".
# FB-122: who released this plan, if anyone. Prints the approver and succeeds; silent failure means
# no release. Read from the state ref rather than the box, so the studio (which cannot reach this
# machine) is the thing that writes it.
release_of() {
  local body approver
  body=$(gh_api "$API/repos/$REPO/contents/approvals/plan-$1.json?ref=$STATE_REF" 2>/dev/null) || return 1
  case "$body" in *'"content"'*) ;; *) return 1 ;; esac
  approver=$(printf '%s' "$body" | jval '.content' | base64 -d 2>/dev/null | jval '.approver')
  [ -n "$approver" ] || return 1
  printf '%s\n' "$approver"
}

ticket_status() { grep -oiE '\*\*Status:\*\*[[:space:]]*[A-Za-z]+' "$1" | head -1 | sed -E 's/.*\*\*Status:\*\*[[:space:]]*//I' | tr '[:upper:]' '[:lower:]'; }
# Is there an open PR for this ticket's claim branch? (parse JSON — don't grep minified output.)
has_open_pr() {
  gh_api "$API/repos/$REPO/pulls?state=open&per_page=100" | node -e "
    let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{
      try{const prs=JSON.parse(d);process.exit(prs.some(p=>p&&p.head&&p.head.ref==='foundry/'+process.argv[1])?0:1);}
      catch{process.exit(1);}
    })" "$1"
}

# --- pick the department to work this wake (FB-045) -------------------------------------------------
# One box serves every department of one venture. Departments are walked in declared order and the
# FIRST workable ticket wins the wake — one dispatch per sweep, so a busy Build queue cannot starve
# Sell of every wake, and the spend stays bounded by the wake budget rather than by department count.
#
# The department also decides how the ticket's work is allowed to end: `pr` means a pull request and
# nothing more; `activegraph` and anything unrecognised mean an external action must be PROPOSED for
# the founder, never performed.
#
# The venture's PRIMARY repo, captured before any department is walked. Scanning rebinds REPO for
# each department, and the liveness heartbeat has to land somewhere the studio actually reads —
# without this it was written against whichever department the loop happened to end on, which is the
# LAST one, which is the one most likely to be misconfigured. Caught live: with Sell and Scale
# declared but not yet cloned, every idle wake reported "could not ensure state ref" and the studio
# stopped hearing from a lane that was running perfectly well.
PRIMARY_REPO="$REPO"
PRIMARY_BASE="$BASE_BRANCH"

work_department() {
  DEPT_ID="$(dept_field "$1" 1)"; REPO="$(dept_field "$1" 2)"
  BASE_BRANCH="$(dept_field "$1" 3)"; DEPT_GATE="$(dept_field "$1" 4)"
  REPO_DIR="$(dept_dir "$REPO")"
  export REPO BASE_BRANCH
  if [ -z "$DEPT_ID" ] || [ -z "$REPO" ] || [ -z "$BASE_BRANCH" ]; then
    flog "malformed department entry '$1' — skipping (expected id:owner/repo:base:gate)"
    return 1
  fi
  # A department whose repo was never cloned is a configuration fact, not a failure to hide: say so
  # once per wake and move on, so the founder's board is not silently missing a whole surface.
  if [ ! -d "$REPO_DIR/.git" ]; then
    flog "$DEPT_ID: $REPO is not cloned at $REPO_DIR — run install-departments.sh on this box"
    return 1
  fi
  return 0
}

refresh_repo() {
  cd "$REPO_DIR"
  # Token supplied per-fetch (origin is tokenless by design — see origin_url in foundry-lib.sh),
  # and written into the remote-tracking ref the checkout below expects.
  git fetch --quiet "$(origin_url)" "+refs/heads/$BASE_BRANCH:refs/remotes/origin/$BASE_BRANCH"
  git checkout --quiet "$BASE_BRANCH" 2>/dev/null || git checkout --quiet -B "$BASE_BRANCH" "origin/$BASE_BRANCH"
  git reset --quiet --hard "origin/$BASE_BRANCH"
  git clean -fd --quiet   # drop untracked leftovers from a prior aborted run (code review P1-1)
}

# --- keep the venture brain current with whatever just merged (FB-050) -----------------------------
# Here is the one moment the worktree is guaranteed to be clean and on the base branch, so it is the
# right place to index. Best-effort and time-boxed: a stale or missing index degrades RESEARCH to
# reading files, it must never stop the lane from working. The 15-min timer covers idle stretches.
# Handed to SYSTEMD, not run inline. An inline `timeout N` would SIGTERM the process group — flock,
# gbrain and all — mid-write on a single-writer index, on every wake whose refresh ran long. systemd
# owns the lifecycle instead: Type=oneshot means an already-running refresh is not started twice, and
# --no-block means the lane never waits on it.
# Gated on -f rather than -x: if the copy on the box ever lands without its executable bit, an -x
# guard would skip the refresh FOREVER without a word, and the lane would research from a frozen
# index believing it was current.
brain_refresh_if_available() {
  command -v gbrain >/dev/null 2>&1 || return 0
  if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files foundry-brain-sync.service >/dev/null 2>&1; then
    systemctl start --no-block foundry-brain-sync.service 2>/dev/null \
      || flog "could not trigger the brain refresh — the 15-minute timer still covers it"
  elif [ -f "$SCRIPT_DIR/gbrain-refresh.sh" ]; then
    # No systemd (a dev box): run it inline, but generously, so a kill can't land mid-write.
    timeout "${BRAIN_REFRESH_TIMEOUT:-1800}" bash "$SCRIPT_DIR/gbrain-refresh.sh" >/dev/null 2>&1 \
      || flog "brain refresh skipped or failed — RESEARCH may be working from a slightly stale index"
  fi
}

# --- fire any routine that is due, BEFORE the scan (FB-047) -----------------------------------------
# A routine the founder approved keeps its cadence whether or not the backlog is busy — otherwise a
# weekly commitment is starved forever by a queue that is never empty, which is the opposite of what
# approving it meant. Firing is one API call and no model session; the ticket it files is worked
# through the ordinary queue below, with the same claim, budget, circuit breaker and founder accept.
#
# Deliberately not fatal and not `set -e`-guarded: the wake's real job is the backlog, and a routine
# that cannot fire is a line in the log rather than a reason to skip work already waiting.
fire_due_routine() {
  # Loud when absent, not silent. Lane files reach a box by hand, so an approved routine that never
  # fires because this file was not copied would look exactly like a routine with nothing to do —
  # the "green and doing nothing" failure this lane has met three times (FB-112, FB-113, ARCA-34).
  if [ ! -f "$SCRIPT_DIR/routines-fire.mjs" ]; then
    flog "routines-fire.mjs is not on this box — approved routines will NOT run until it is copied"
    return 0
  fi
  command -v node >/dev/null 2>&1 || { flog "no node — routines skipped this wake"; return 0; }
  REPO="$PRIMARY_REPO" STATE_REF="${STATE_REF:-foundry-state}" \
    node "$SCRIPT_DIR/routines-fire.mjs" 2>&1 | while IFS= read -r line; do flog "$line"; done
  return 0
}
fire_due_routine

# --- scan each department for the first workable ticket ---------------------------------------------
PICK="" PICK_SLUG="" PICK_DEPT="" PICK_GATE="" PICK_REPO="" PICK_DIR="" PICK_BASE=""
# FB-121: how much of the queue is held on the founder rather than on us. An idle wake with ten
# tickets waiting for a go is not the same fact as an idle wake with an empty queue, and a founder
# who cannot tell them apart has no way to know they are the blocker.
HELD=0; HELD_NAMES=""
shopt -s nullglob
scan_department() {
for f in docs/tickets/*.md; do
  # Not every .md in a queue directory is a ticket, and a status grep alone cannot tell the
  # difference. Caught live on the first Sell wake: the queue's own README explains the format —
  # "`**Status:** Todo` means the lane may pick it up" — so the grep matched the documentation and
  # the lane claimed `foundry/README` and worked it. The studio's parser skips non-tickets the same
  # way; a queue must be able to hold a note about itself.
  case "$(basename "$f")" in README.md|readme.md|_*) continue ;; esac
  # A ticket has a title line (`# ID — Title`). A file without one is a note, not work.
  grep -qE '^#[[:space:]]+\S' "$f" || continue
  case "$(ticket_status "$f")" in todo|ready) ;; *) continue ;; esac
  slug=$(basename "$f" .md)
  if git ls-remote --exit-code --heads "$(origin_url)" "foundry/$slug" >/dev/null 2>&1; then
    if has_open_pr "$slug"; then continue; fi   # in-flight (open PR) → leave it
    flog "reclaiming stale orphan claim foundry/$slug (branch exists, no open PR)"
    gh_api -X DELETE "$API/repos/$REPO/git/refs/heads/foundry/$slug" >/dev/null || true
  fi
  # Un-stick: if a human EDITED the ticket after we gave up on it, clear the attempt history so the lane
  # retries the (presumably fixed) ticket (code review P2-3).
  if [ -f "$STATE_DIR/gaveup-$slug" ] && [ "$f" -nt "$STATE_DIR/gaveup-$slug" ]; then
    flog "$slug edited since we gave up — clearing attempts to retry"
    rm -f "$STATE_DIR/gaveup-$slug" "$STATE_DIR/attempts-$slug"
  fi
  # Circuit breaker: after MAX_ATTEMPTS, surface ONE terminal blocked report (no silent abandonment —
  # adversarial review P1), mark it given-up so we don't re-scan it, and move on.
  if [ "$(attempts_of "$slug")" -ge "$MAX_ATTEMPTS" ]; then
    if [ ! -f "$STATE_DIR/gaveup-$slug" ]; then
      write_runreport "$slug" "blocked" "The lane tried this $MAX_ATTEMPTS times and couldn't get it past its own review/tests. It needs a human — parked." || true
      : > "$STATE_DIR/gaveup-$slug"
    fi
    flog "skip $slug — gave up after $MAX_ATTEMPTS attempts (surfaced)"; continue
  fi
  # FB-121: parked awaiting the founder's go. This used to be checked AFTER the scan had committed
  # to a pick, where the only thing left to do was `exit 0` — ending the whole wake. So one ticket
  # waiting on a person stopped every ticket alphabetically behind it, and ARCA sat for five days
  # with ten workable tickets and 864 wakes that did nothing. Here it is a `continue`, which is what
  # "cannot work this one" means everywhere else in this loop.
  if [ -f "$STATE_DIR/awaiting-$slug" ]; then
    # FB-122: unless the founder has released it from the studio. Before this there was no exit from
    # the sensitive gate at all — the marker was written and nothing anywhere deleted it, so a plan
    # the lane stopped to show someone could never be approved. ARCA-054 sat behind it for a week
    # and was eventually done by hand.
    #
    # The marker is UNSIGNED and this lane trusts it, which is only defensible because of what this
    # gate is: it exists so the lane does not spend model time and open a PR on high-blast-radius
    # work before a person has read what it intends to do. It is not a security boundary. Engineering
    # change is gated on the pull request; anything leaving the building is gated on a signed
    # ActiveGraph approval this box holds no secret for. The record of WHO released a plan is written
    # into the studio's own ActiveGraph, where this lane has no credential and cannot forge one.
    if release_of "$slug" >/dev/null; then
      flog "$slug released by $(release_of "$slug") — clearing the hold and working it"
      rm -f "$STATE_DIR/awaiting-$slug"
    else
      HELD=$((HELD + 1)); HELD_NAMES="${HELD_NAMES:+$HELD_NAMES, }$slug"
      flog "skip $slug — waiting on your go (held)"; continue
    fi
  fi
  PICK="$REPO_DIR/$f"; PICK_SLUG="$slug"
  PICK_DEPT="$DEPT_ID"; PICK_GATE="$DEPT_GATE"; PICK_REPO="$REPO"; PICK_DIR="$REPO_DIR"; PICK_BASE="$BASE_BRANCH"
  return 0
done
return 1
}

for entry in $(departments); do
  work_department "$entry" || continue
  refresh_repo
  brain_refresh_if_available
  scan_department && break
done
# Everything below runs against the department the pick came from — not whichever one the loop
# happened to end on. With no pick at all, fall back to the venture's primary repo so the heartbeat
# is written where the studio reads it.
if [ -n "$PICK" ]; then
  REPO="$PICK_REPO"; REPO_DIR="$PICK_DIR"; export REPO
  BASE_BRANCH="$PICK_BASE"; export BASE_BRANCH
  cd "$REPO_DIR"
else
  REPO="$PRIMARY_REPO"; BASE_BRANCH="$PRIMARY_BASE"; export REPO BASE_BRANCH
fi

# --- "useful work?" — nothing ready → idle heartbeat, no model session -----------------------------
if [ -z "$PICK" ]; then
  # FB-121: two different facts, said differently. `awaiting_founder` maps to `awaiting-approval` in
  # the contract, so the studio shows a lane held on a person rather than one with nothing to do —
  # and the heartbeat is still a heartbeat, because liveness keys off the slug, not the outcome.
  if [ "$HELD" -gt 0 ]; then
    flog "nothing workable — $HELD ticket(s) held on your go: $HELD_NAMES"
    write_runreport "heartbeat" "awaiting_founder" \
      "Lane awake with nothing it may work: $HELD ticket(s) are waiting for your go — $HELD_NAMES. Nothing else is queued." || true
  else
    flog "no workable Todo/Ready ticket — idle"
    write_runreport "heartbeat" "idle" "Lane awake — nothing to work right now." || true
  fi
  exit 0
fi

# --- budget gate -----------------------------------------------------------------------------------
if [ "$(runs_today)" -ge "$DAILY_WAKE_BUDGET" ]; then
  flog "daily wake budget reached ($DAILY_WAKE_BUDGET) — parking"
  write_runreport "$PICK_SLUG" "blocked" "Daily lane budget reached — parked until tomorrow." || true
  exit 0
fi

# --- blast-radius routing ---------------------------------------------------------------------------
# Two different questions, answered separately since FB-045.
#
#   1. Is this ENGINEERING high-blast-radius (auth, payments, migrations, secrets, deploys)? Then the
#      lane plans it and stops, in every department. There is no approval route that makes an agent
#      rewriting an auth path safe, so the founder reads a plan and decides.
#
#   2. Would it reach someone outside the company? That depends on the department. Sell has a gate
#      (`activegraph`) and a separate executor holding the credentials, so the work is done properly
#      in a PR and the ACTION is proposed for approval — the founder gets a real thing to approve
#      rather than a plan to read. Build has no such route, so an external action there still stops
#      at a plan, exactly as before.
#
# `outreach` and `send email` used to sit in the engineering list, which is why every send stopped at
# a plan and the approval gate had nothing to render.
ENGINEERING_SENSITIVE='\bauth(entication|orization)?\b|password|payment|billing|stripe|\bmigration\b|secret|credential|\bdeploy\b'
REQUIRE_PROPOSAL=0
if ! grep -qiE "$ENGINEERING_SENSITIVE" "$PICK" && is_external_action "$PICK"; then
  case "$PICK_GATE" in
    pr|'') : ;;                       # no approval route in this department → falls through to plan
    *) REQUIRE_PROPOSAL=1 ;;          # activegraph, tbd-fb012, anything unrecognised → propose it
  esac
fi

if [ "$REQUIRE_PROPOSAL" = 0 ] && grep -qiE "$ENGINEERING_SENSITIVE|\boutreach\b|send.{0,6}email" "$PICK"; then
  # Produce the plan ONCE (not every wake) so the founder sees exactly what the lane WOULD do before
  # approving — honest "stop-at-PLAN", not stop-before-plan (adversarial review P1).
  # (The "already surfaced" check that used to live here is gone: the scan skips a parked ticket
  # before it can be picked, so reaching this line means we are surfacing a plan for the first time.
  # Two places deciding the same thing is what FB-121 was — `continue` in one, `exit` in the other.)
  flog "$PICK_SLUG classified SENSITIVE → planning for founder review (no PR)"
  echo "$PICK_SLUG $(date -u +%FT%TZ)" >> "$BUDGET_FILE"   # a plan session counts against the budget
  PLAN_OUT="$STATE_DIR/sensitive-plan-$PICK_SLUG.md"
  set +e
  claude_lane "$PLAN_TIMEOUT" "This is a HIGH-IMPACT ticket (auth/payments/sends/migrations/secrets). Do NOT implement anything and
do NOT edit files. Write a short plain-English plan of what you WOULD do and the risks, so the founder
can decide. Output only the plan.

TICKET:
$(cat "$PICK")" >"$PLAN_OUT" 2>&1
  set -e
  PLAN_EXCERPT=$(head -c 600 "$PLAN_OUT" 2>/dev/null | tr '\n' ' ')
  write_runreport "$PICK_SLUG" "awaiting_founder" "This looks high-impact (auth/payments/sends/migrations). The lane planned it but paused for your go before doing anything. Plan: ${PLAN_EXCERPT:-（unavailable）}" || true
  : > "$STATE_DIR/awaiting-$PICK_SLUG"
  exit 0
fi

# --- run the RPIV lane: count the wake + the attempt, then hand the ticket to the supervisor --------
echo "$PICK_SLUG $(date -u +%FT%TZ)" >> "$BUDGET_FILE"
echo $(( $(attempts_of "$PICK_SLUG") + 1 )) > "$STATE_DIR/attempts-$PICK_SLUG"
if [ "$REQUIRE_PROPOSAL" = 1 ]; then
  flog "working $PICK_SLUG in $PICK_DEPT (RPIV; the external action will be PROPOSED, never performed)"
else
  flog "working $PICK_SLUG in ${PICK_DEPT:-build} (full-auto RPIV, low blast-radius)"
fi
LANE_DEPARTMENT="${PICK_DEPT:-build}" LANE_GATE="${PICK_GATE:-pr}" LANE_REQUIRE_PROPOSAL="$REQUIRE_PROPOSAL" \
  "$SUP" "$PICK_SLUG" "$PICK"
