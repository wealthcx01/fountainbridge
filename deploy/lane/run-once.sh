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
# Each wake now runs the RPIV loop = up to ~4 agentic sessions (plan/implement/review/qa), not one, so
# the default wake budget is lower to stay within shared Claude Max limits (adversarial review P2).
: "${DAILY_WAKE_BUDGET:=8}"
: "${MAX_ATTEMPTS:=3}"          # per-ticket circuit breaker
: "${PLAN_TIMEOUT:=600}"
STATE_DIR="${STATE_DIR:-/opt/foundry/lane/state}"; mkdir -p "$STATE_DIR"
SUP="$SCRIPT_DIR/supervisor.sh"

DAY=$(date -u +%F); BUDGET_FILE="$STATE_DIR/wakes-$DAY"
runs_today() { if [ -f "$BUDGET_FILE" ]; then wc -l < "$BUDGET_FILE" | tr -d ' '; else echo 0; fi; }
attempts_of() { if [ -f "$STATE_DIR/attempts-$1" ]; then cat "$STATE_DIR/attempts-$1"; else echo 0; fi; }

# Read a ticket's Status field (lowercased first word), e.g. "todo".
ticket_status() { grep -oiE '\*\*Status:\*\*[[:space:]]*[A-Za-z]+' "$1" | head -1 | sed -E 's/.*\*\*Status:\*\*[[:space:]]*//I' | tr '[:upper:]' '[:lower:]'; }
# Is there an open PR for this ticket's claim branch? (parse JSON — don't grep minified output.)
has_open_pr() {
  gh_api "$API/repos/$REPO/pulls?state=open&per_page=100" | node -e "
    let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{
      try{const prs=JSON.parse(d);process.exit(prs.some(p=>p&&p.head&&p.head.ref==='foundry/'+process.argv[1])?0:1);}
      catch{process.exit(1);}
    })" "$1"
}

# --- refresh the repo to origin/base ---------------------------------------------------------------
cd "$REPO_DIR"
git fetch --quiet origin "$BASE_BRANCH"
git checkout --quiet "$BASE_BRANCH" 2>/dev/null || git checkout --quiet -B "$BASE_BRANCH" "origin/$BASE_BRANCH"
git reset --quiet --hard "origin/$BASE_BRANCH"
git clean -fd --quiet   # drop untracked leftovers from a prior aborted run (code review P1-1)

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
if command -v gbrain >/dev/null 2>&1; then
  if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files foundry-brain-sync.service >/dev/null 2>&1; then
    systemctl start --no-block foundry-brain-sync.service 2>/dev/null \
      || flog "could not trigger the brain refresh — the 15-minute timer still covers it"
  elif [ -f "$SCRIPT_DIR/gbrain-refresh.sh" ]; then
    # No systemd (a dev box): run it inline, but generously, so a kill can't land mid-write.
    timeout "${BRAIN_REFRESH_TIMEOUT:-1800}" bash "$SCRIPT_DIR/gbrain-refresh.sh" >/dev/null 2>&1 \
      || flog "brain refresh skipped or failed — RESEARCH may be working from a slightly stale index"
  fi
fi

# --- scan for the first workable ticket ------------------------------------------------------------
PICK="" PICK_SLUG=""
shopt -s nullglob
for f in docs/tickets/*.md; do
  case "$(ticket_status "$f")" in todo|ready) ;; *) continue ;; esac
  slug=$(basename "$f" .md)
  if git ls-remote --exit-code --heads origin "foundry/$slug" >/dev/null 2>&1; then
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
  PICK="$f"; PICK_SLUG="$slug"; break
done

# --- "useful work?" — nothing ready → idle heartbeat, no model session -----------------------------
if [ -z "$PICK" ]; then
  flog "no workable Todo/Ready ticket — idle"
  write_runreport "heartbeat" "idle" "Lane awake — nothing to work right now." || true
  exit 0
fi

# --- budget gate -----------------------------------------------------------------------------------
if [ "$(runs_today)" -ge "$DAILY_WAKE_BUDGET" ]; then
  flog "daily wake budget reached ($DAILY_WAKE_BUDGET) — parking"
  write_runreport "$PICK_SLUG" "blocked" "Daily lane budget reached — parked until tomorrow." || true
  exit 0
fi

# --- blast-radius routing: sensitive → stop-at-PLAN (produce a plan, then wait for the founder) -----
if grep -qiE '\bauth(entication|orization)?\b|password|payment|billing|stripe|\bmigration\b|secret|credential|outreach|send.{0,6}email|\bdeploy\b' "$PICK"; then
  # Produce the plan ONCE (not every wake) so the founder sees exactly what the lane WOULD do before
  # approving — honest "stop-at-PLAN", not stop-before-plan (adversarial review P1).
  if [ -f "$STATE_DIR/awaiting-$PICK_SLUG" ]; then
    flog "$PICK_SLUG already surfaced for founder go — skipping"; exit 0
  fi
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

# --- full-auto: count the wake + the attempt, then run the RPIV lane --------------------------------
echo "$PICK_SLUG $(date -u +%FT%TZ)" >> "$BUDGET_FILE"
echo $(( $(attempts_of "$PICK_SLUG") + 1 )) > "$STATE_DIR/attempts-$PICK_SLUG"
flog "working $PICK_SLUG (full-auto RPIV, low blast-radius)"
"$SUP" "$PICK_SLUG" "$PICK"
