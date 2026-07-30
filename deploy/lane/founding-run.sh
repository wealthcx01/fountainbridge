#!/usr/bin/env bash
# Venture founding run (FB-056) — a venture's first day.
#
#   founding-run.sh <mission-file> [start-at]
#
# A founder writes a paragraph about what they are building. A Chief-of-Staff session (gstack
# /office-hours + /plan-ceo-review) turns it into a north-star, the first goals and a starter
# backlog; this script files that as a PR against the venture repo. A human merges it, or does not.
#
# This is NOT part of the per-ticket RPIV loop (supervisor.sh) and is not on the timer. It is run
# once, by hand, when a venture is seeded — so it lives in its own script rather than as a branch
# inside the wake path, and it never touches the lane's claim/attempt state.
#
# Safety, in order of how badly each would hurt:
#   - It NEVER merges. The PR is the gate (non-negotiable 2), and merging it is the founder's
#     decision about what their venture is.
#   - It validates the plan BEFORE creating a branch. A half-written founding run in a founder's
#     repo is worse than one that never started.
#   - It refuses to run against a repo that already has a backlog, unless given an explicit
#     start-at. Seeding tickets on top of real work is not recoverable by "just close the PR".
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/lane/foundry-lib.sh
. "$SCRIPT_DIR/foundry-lib.sh"

MISSION_FILE="${1:-}"
START_AT="${2:-}"
: "${REPO_DIR:=/opt/foundry/lane/arca}"
: "${VENTURE_ID:=arca}"
: "${VENTURE_NAME:=ARCA}"
: "${FOUNDING_TIMEOUT:=1800}"
: "${TICKET_GITHUB_TOKEN:?need a repo-write token (lane identity)}"

if [ -z "$MISSION_FILE" ] || [ ! -f "$MISSION_FILE" ]; then
  echo "usage: founding-run.sh <mission-file> [start-at]" >&2
  echo "  the mission file is a paragraph or two: what this venture is, for whom, and why now." >&2
  exit 2
fi
if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "need Claude auth: set CLAUDE_CODE_OAUTH_TOKEN (Max, preferred) or ANTHROPIC_API_KEY" >&2
  exit 1
fi

RUNDIR=$(mktemp -d); trap 'rm -rf "$RUNDIR"' EXIT
PLAN_CLI="$SCRIPT_DIR/founding-plan.mjs"
[ -f "$PLAN_CLI" ] || { flog "founding-plan.mjs is not installed next to this script"; exit 1; }

# --- refresh the repo ------------------------------------------------------------------------------
cd "$REPO_DIR"
git fetch --quiet origin "$BASE_BRANCH"
git checkout --quiet "$BASE_BRANCH" 2>/dev/null || git checkout --quiet -B "$BASE_BRANCH" "origin/$BASE_BRANCH"
git reset --quiet --hard "origin/$BASE_BRANCH"
git clean -fd --quiet

# --- refuse to seed on top of an existing backlog --------------------------------------------------
# Counted from the repo, not from state: this script is run by hand, possibly months apart, and the
# only trustworthy answer to "does this venture already have work?" is the board itself.
EXISTING=0
shopt -s nullglob
for f in docs/tickets/*.md; do [ -e "$f" ] && EXISTING=$((EXISTING + 1)); done
if [ "$EXISTING" -gt 0 ] && [ -z "$START_AT" ]; then
  flog "$REPO already has $EXISTING ticket(s) on $BASE_BRANCH."
  flog "A founding run seeds a NEW venture. If you meant to add to this backlog, re-run with an"
  flog "explicit start-at above the highest existing number, e.g. founding-run.sh mission.txt 20."
  exit 1
fi

# --- the Chief-of-Staff session --------------------------------------------------------------------
flog "founding run for $VENTURE_NAME ($VENTURE_ID) — mission: $MISSION_FILE"
SESSION="$RUNDIR/session.txt"
set +e
claude_lane "$FOUNDING_TIMEOUT" "You are the Chief of Staff for a brand-new venture called $VENTURE_NAME.

Work the founder's mission statement below through gstack's /office-hours (pressure-test the idea:
who is it for, what is the wedge, what would have to be true) and then /plan-ceo-review (is this the
right first backlog, is anything load-bearing missing).

Then output a founding plan as a SINGLE JSON object and nothing else after it:

{
  \"northStar\": \"one sentence a founder would repeat — the outcome, not the activity\",
  \"goals\": [{\"title\": \"...\", \"why\": \"...\"}],
  \"tickets\": [
    {\"title\": \"...\", \"why\": \"why this matters to the founder, in plain English\",
     \"scope\": [\"...\"], \"outOfScope\": [\"...\"], \"acceptance\": [\"observable, checkable\"]}
  ]
}

Rules that decide whether this is usable:
  - At least 4 starter tickets, each one a real first step someone could pick up on Monday.
  - EVERY ticket needs acceptance criteria that are observable — the lane turns these into its
    validation gates later, and a ticket that cannot say what done means will block on its first run.
  - Plain English throughout. A founder reads this, not an engineer.
  - No auth, payments, sends or migrations in the starter backlog — those are gated work, and a
    founding run must not seed a venture with tickets its own lane is forbidden to touch.

MISSION:
$(cat "$MISSION_FILE")" >"$SESSION" 2>&1
SESSION_RC=$?
set -e

if [ "$SESSION_RC" -ne 0 ]; then
  flog "the Chief-of-Staff session failed or timed out (rc=$SESSION_RC) — nothing was written"
  tail -20 "$SESSION" >&2 || true
  exit 1
fi

# --- validate BEFORE touching the repo -------------------------------------------------------------
if ! node "$PLAN_CLI" check "$SESSION"; then
  flog "no usable founding plan — nothing was written. The session output is above."
  exit 1
fi

# --- render + commit on a branch -------------------------------------------------------------------
BRANCH="foundry/founding-run"
git checkout --quiet -B "$BRANCH" "origin/$BASE_BRANCH"
if ! node "$PLAN_CLI" render "$SESSION" "$VENTURE_ID" "$VENTURE_NAME" "$REPO_DIR" "${START_AT:-1}"; then
  flog "could not render the founding plan — nothing was committed"
  git checkout --quiet "$BASE_BRANCH"
  exit 1
fi

git add docs/tickets context
if git diff --cached --quiet; then
  flog "the plan rendered no new files — nothing to open a PR for"
  git checkout --quiet "$BASE_BRANCH"
  exit 1
fi
git -c user.name="Foundry Lane" -c user.email="lane@bruntsfield.capital" \
  commit --quiet -m "$VENTURE_NAME: founding run — north-star, first goals, starter backlog

Drafted by a Chief-of-Staff session from the founder's mission statement (FB-056).
Nothing here is authoritative until a human merges it."
git push --quiet --force-with-lease origin "$BRANCH"

# --- open the PR (a human merges — non-negotiable 2) -----------------------------------------------
node "$PLAN_CLI" pr-body "$SESSION" "$VENTURE_ID" "$VENTURE_NAME" "$MISSION_FILE" >"$RUNDIR/body.md"
PR_JSON=$(node -e '
  const [title,head,base,bodyPath]=process.argv.slice(1);
  const body=require("node:fs").readFileSync(bodyPath,"utf8");
  process.stdout.write(JSON.stringify({title,head,base,body}));
' "$VENTURE_NAME — founding run" "$BRANCH" "$BASE_BRANCH" "$RUNDIR/body.md")

PR_URL=$(gh_api -X POST "$API/repos/$REPO/pulls" -d "$PR_JSON" | jval '.html_url')
if [ -z "$PR_URL" ]; then
  flog "the branch is pushed but the PR could not be opened — open it by hand from $BRANCH"
  exit 1
fi

flog "founding run → $PR_URL"
write_runreport "founding-run" "opened_pr" \
  "$VENTURE_NAME's founding run is ready for you: a north-star, the first goals and a starter backlog. Read it, cut what's wrong, then merge — merging is what makes it real." \
  "$PR_URL" || true
echo "$PR_URL"
