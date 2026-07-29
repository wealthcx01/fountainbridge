#!/usr/bin/env bash
# Foundry autonomous lane wake (FB-040). ONE pass, called by the systemd timer:
#   budget check → scan for a workable ticket → "useful work?" (idle heartbeat if none) →
#   stale-claim reclaim → circuit-breaker → blast-radius routing → run the lane full-auto,
#   OR stop-at-PLAN for a sensitive ticket (awaiting the founder's go — design §8).
#
# Safety: only Status `Todo`/`Ready` tickets are auto-worked (a real backlog of Planned/Shipped
# tickets is never touched); sensitive tickets (auth/payments/sends/migrations/secrets) never
# auto-open a PR; a per-day wake budget + per-ticket attempt cap bound the spend (§10b). The box
# holds no send/deploy creds, so the lane can never send or deploy regardless (§8).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/lane/foundry-lib.sh
. "$SCRIPT_DIR/foundry-lib.sh"

: "${REPO_DIR:=/opt/foundry/lane/arca}"
: "${TICKET_GITHUB_TOKEN:?need a repo-write token (lane identity)}"
: "${ANTHROPIC_API_KEY:?need Claude auth}"
: "${DAILY_WAKE_BUDGET:=20}"    # Max-path local cap — shared Max has no per-venture programmatic cap
: "${MAX_ATTEMPTS:=3}"          # per-ticket circuit breaker
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
  [ "$(attempts_of "$slug")" -ge "$MAX_ATTEMPTS" ] && { flog "skip $slug — hit max attempts ($MAX_ATTEMPTS)"; continue; }
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

# --- blast-radius routing: sensitive → stop-at-PLAN (no auto-PR) ------------------------------------
if grep -qiE '\bauth(entication|orization)?\b|password|payment|billing|stripe|\bmigration\b|secret|credential|outreach|send.{0,6}email|\bdeploy\b' "$PICK"; then
  flog "$PICK_SLUG classified SENSITIVE → stop-at-PLAN (awaiting founder go)"
  write_runreport "$PICK_SLUG" "awaiting_founder" "This looks high-impact (auth/payments/sends/migrations). The lane paused for your go before doing it." || true
  exit 0
fi

# --- full-auto: count the wake + the attempt, then run the lane ------------------------------------
echo "$PICK_SLUG $(date -u +%FT%TZ)" >> "$BUDGET_FILE"
echo $(( $(attempts_of "$PICK_SLUG") + 1 )) > "$STATE_DIR/attempts-$PICK_SLUG"
flog "working $PICK_SLUG (full-auto, low blast-radius)"
"$SUP" "$PICK_SLUG" "$PICK"
