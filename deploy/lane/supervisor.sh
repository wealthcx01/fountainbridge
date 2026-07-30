#!/usr/bin/env bash
# Foundry lane supervisor — the RPIV loop (FB-041), the disciplined engine behind the composer.
#
# The lane no longer just edits a file (the thin FB-040 version). It runs the full Bruntsfield/gstack
# loop and reviews + tests its own work BEFORE the founder ever sees a PR:
#
#   CLAIM (branch-create CAS) → ROUTE (department) → RESEARCH (context/) → PLAN (/plan → PRP-lite)
#   → IMPLEMENT → COMMIT (to the claim branch, local) → VALIDATE (tests[HARD] + /review[HARD] +
#   /qa[SOFT]) → GATE: pass ⇒ push + PR (a human still merges, §2); any fail ⇒ a plain-language
#   `blocked` RunReport, no push, no PR (nothing fails silently, #10).
#
# The SUPERVISOR owns the gate (bash control flow), not the model — so "PR only after review + qa pass"
# is structural, and the gate binds to OBJECTIVE signals (test/typecheck/lint exit codes + gstack's own
# review artifact), not a self-graded boolean. Full design: docs/lane-rpiv-loop.md.
#
# SAFETY (§8): this box holds NO send/deploy/payment creds — the lane can only write to the repo and
# open a PR. External actions are the separate gated executor's job (FB-044), never the lane's.
# AUTH LADDER: prefers Claude Max (CLAUDE_CODE_OAUTH_TOKEN); falls back to ANTHROPIC_API_KEY.
#
# Usage: supervisor.sh <slug> <ticket-file>
set -euo pipefail

: "${REPO:=wealthcx01/arca}"
: "${REPO_DIR:=/opt/foundry/lane/arca}"
: "${BASE_BRANCH:=master}"
: "${TICKET_GITHUB_TOKEN:?need a repo-write token (lane identity)}"
if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "need Claude auth: set CLAUDE_CODE_OAUTH_TOKEN (Max, preferred) or ANTHROPIC_API_KEY" >&2; exit 1
fi
STATE_REF="foundry-state"
API="https://api.github.com"

# Per-phase timeouts (seconds) — every agentic phase is wrapped so nothing can hang the box.
: "${PLAN_TIMEOUT:=600}" "${IMPL_TIMEOUT:=1800}" "${REVIEW_TIMEOUT:=900}" "${QA_TIMEOUT:=1200}"
: "${QA_MIN_FREE_MB:=700}"   # /qa pre-flight RAM floor (adversarial review P0-2)

SLUG="${1:?usage: supervisor.sh <slug> <ticket-file>}"
TICKET_FILE="${2:?usage: supervisor.sh <slug> <ticket-file>}"
BRANCH="foundry/${SLUG}"
NOW() { date -u +%Y-%m-%dT%H:%M:%SZ; }
STARTED="$(NOW)"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/lane/foundry-lib.sh
. "$SCRIPT_DIR/foundry-lib.sh"
log() { flog "$@"; }

# Run scratch lives OUTSIDE the venture worktree (adversarial review P0-4) so `git add` never sweeps
# plan/verdict/log files into the repo.
RUNDIR="${STATE_DIR:-/opt/foundry/lane/state}/runs/${SLUG}-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$RUNDIR"

fail()    { write_runreport "$SLUG" "failed"  "$1" "" "$STARTED"; flog "FAILED: $1";  exit 1; }
blocked() { write_runreport "$SLUG" "blocked" "$1" "" "$STARTED"; flog "BLOCKED: $1"; exit 0; }

# --- 1. CLAIM: branch-create compare-and-swap (the atomic lock) ------------------------------------
BASE_SHA=$(gh_api "$API/repos/$REPO/git/ref/heads/$BASE_BRANCH" | jval '.object.sha')
[ -n "$BASE_SHA" ] || fail "could not read $BASE_BRANCH head"
CLAIM_CODE=$(gh_api -o /dev/null -w '%{http_code}' -X POST "$API/repos/$REPO/git/refs" \
  -d "{\"ref\":\"refs/heads/$BRANCH\",\"sha\":\"$BASE_SHA\"}")
if [ "$CLAIM_CODE" = "422" ]; then log "ticket already claimed ($BRANCH exists) — yielding"; exit 0; fi
[ "$CLAIM_CODE" = "201" ] || fail "claim failed (HTTP $CLAIM_CODE)"
log "claimed $BRANCH"
write_runreport "$SLUG" "working" "Lane claimed the ticket and started work." "" "$STARTED"

# --- 2. ROUTE: work only this box's department (FB-041 slice; FB-045 provisions Sell/Scale) ---------
DEPT="$(ticket_department "$TICKET_FILE")"
if [ "$DEPT" != "$LANE_DEPARTMENT" ]; then
  # Release the claim so the right department's lane can pick it up once provisioned.
  gh_api -X DELETE "$API/repos/$REPO/git/refs/heads/$BRANCH" >/dev/null || true
  blocked "This ticket belongs to the '$DEPT' surface, whose repo isn't set up yet (arrives with FB-045). Parked."
fi
log "routed to department '$DEPT'"

# --- 3. check out the claimed branch; flip the ticket Status Todo → In progress ---------------------
cd "$REPO_DIR"
git fetch --quiet origin "$BRANCH"
git checkout --quiet -B "$BRANCH" "origin/$BRANCH"
REPO_TICKET="$REPO_DIR/docs/tickets/${SLUG}.md"
if [ -f "$REPO_TICKET" ]; then
  sed -i -E 's/(\*\*Status:\*\*[[:space:]]*)[Tt]odo/\1In progress/' "$REPO_TICKET" || true
fi

# --- 4a. BASELINE probe: the venture's own toolchain BEFORE the lane touches anything, so the gate can
#         measure the lane's REGRESSION (not pre-existing debt — arca's typecheck/lint are red on master).
log "baseline toolchain probe…"
toolchain_probe "$REPO_DIR" "$RUNDIR/base.log" > "$RUNDIR/base.res" || true
log "baseline: $(tr '\n' ' ' <"$RUNDIR/base.res")"

# --- 4. RESEARCH: point the lane at the venture's shared brain (D8 context/, FB-043) ----------------
# gbrain semantic search over context/library/tickets/code arrives in FB-050; today the lane reads the
# deposited context/ files raw.
CONTEXT_HINT=""
[ -d "$REPO_DIR/context" ] && CONTEXT_HINT="
Before planning, read anything relevant under \`context/\` — the founder's durable knowledge (audience,
brand, positioning, pricing), deposited via the composer. Let it inform the work."

# --- 5. PLAN: produce a PRP-lite the implement step follows (full PRP is FB-052) --------------------
PLAN_FILE="$RUNDIR/plan.md"
log "PLAN…"
set +e
claude_lane "$PLAN_TIMEOUT" "You are a Foundry engineering lane on the '$REPO' repo working ONE ticket.
FIRST research, THEN plan — do not write any code yet.${CONTEXT_HINT}
Write a short, concrete implementation plan (a PRP-lite: the smallest correct change, the files you'll
touch, and how you'll verify it) to the absolute path $PLAN_FILE. Keep it tight.

TICKET:
$(cat "$TICKET_FILE")" >"$RUNDIR/plan.log" 2>&1
rc=$?; set -e
phase_blocked "$RUNDIR/plan.log" && blocked "The lane needed a human decision while planning (it stopped rather than guess). See the ticket."
[ $rc -eq 124 ] && blocked "Planning timed out after ${PLAN_TIMEOUT}s — parked for a retry."
[ -s "$PLAN_FILE" ] || blocked "The lane couldn't produce a plan for this ticket."
log "plan written ($(wc -l <"$PLAN_FILE") lines)"

# --- 6. IMPLEMENT: smallest correct change per the plan (no commit here — the supervisor commits) ----
log "IMPLEMENT…"
set +e
claude_lane "$IMPL_TIMEOUT" "You are a Foundry engineering lane on the '$REPO' repo. Implement EXACTLY this ticket by following
your plan at $PLAN_FILE. Make the smallest correct change. Edit files in the working tree only — do
NOT commit, push, or open a PR (the supervisor does that), and do NOT run deploy or send commands.
When done, print ONE plain-English line summarising what you changed.

TICKET:
$(cat "$TICKET_FILE")" >"$RUNDIR/impl.log" 2>&1
rc=$?; set -e
phase_blocked "$RUNDIR/impl.log" && blocked "The lane needed a human decision while implementing (it stopped rather than guess)."
[ $rc -eq 124 ] && blocked "Implementation timed out after ${IMPL_TIMEOUT}s — parked for a retry."
SUMMARY=$(tail -1 "$RUNDIR/impl.log" 2>/dev/null); [ -n "$SUMMARY" ] || SUMMARY="Lane worked the ticket."

# --- 7. COMMIT the diff to the claim branch (local) so VALIDATE runs against the exact PR content ----
git add -A
git diff --cached --quiet && fail "the lane produced no changes"
git -c user.email="lane@bruntsfield.capital" -c user.name="Foundry Lane" \
    commit -q -m "ARCA: $SLUG (worked by the Foundry lane)"
log "committed $(git rev-parse --short HEAD) (local — not pushed until the gate passes)"

# --- 8. VALIDATE — the hard floor, bound to objective signals --------------------------------------
# 8a. tests / typecheck / lint — gate on REGRESSION vs the baseline (unfakeable exit codes), so the lane
#     is blocked only by breakage IT introduced, never by the venture's pre-existing debt.
log "VALIDATE: tests (vs baseline)…"
toolchain_probe "$REPO_DIR" "$RUNDIR/branch.log" > "$RUNDIR/branch.res" || true
log "branch: $(tr '\n' ' ' <"$RUNDIR/branch.res")"
set +e; TESTS_MSG=$(venture_regression "$RUNDIR/base.res" "$RUNDIR/branch.res"); rc=$?; set -e
[ $rc -ne 0 ] && blocked "Its own tests caught a problem — ${TESTS_MSG}. No PR opened; needs a fix."
log "tests OK (no regression vs baseline)"

# 8b. /review (staff-engineer audit incl. adversarial subagent). Gate on gstack's review artifact AND
# on whether /review wanted to edit the code (it edited ⇒ not clean ⇒ block).
log "VALIDATE: /review…"
set +e
claude_lane "$REVIEW_TIMEOUT" "Run /review on the changes in this branch versus $BASE_BRANCH. Do a thorough staff-engineer
audit. Report findings; the supervisor gates on your review log, so be honest about must-fix issues." \
  >"$RUNDIR/review.log" 2>&1
rc=$?; set -e
phase_blocked "$RUNDIR/review.log" && blocked "/review needed a human decision (it stopped rather than guess). Needs your eyes."
[ $rc -eq 124 ] && blocked "/review timed out after ${REVIEW_TIMEOUT}s — parked for a retry."
if ! git diff --quiet HEAD; then
  git checkout -q -- . || true
  blocked "/review found issues it wanted to change in the code — not clean enough to ship. Parked for a rework."
fi
RSTATUS="$(review_status "$REPO_DIR")"   # "<status> <critical>" or "NONE"
RCRIT="$(printf '%s' "$RSTATUS" | awk '{print $2+0}')"
RVERD="$(printf '%s' "$RSTATUS" | awk '{print toupper($1)}')"
if [ "$RCRIT" -gt 0 ] 2>/dev/null; then
  blocked "/review flagged $RCRIT critical issue(s) — not ready. No PR opened; needs a rework."
fi
case "$RVERD" in ""|NONE|BLOCK|BLOCKED|NEEDS_WORK|REWORK|FAIL) blocked "/review didn't clear this change to ship (verdict: ${RVERD:-none}). Parked." ;; esac
log "/review clear ($RSTATUS)"

# 8c. /qa (browser) — SOFT: runs always, blocks on real bugs, DEFERS when it can't test (no web
# surface / app won't boot / low memory). Pre-flight RAM check protects the founder's live composer.
QA_NOTE="ran clean"
FREE_MB="$(mem_available_mb)"
if [ "$FREE_MB" -lt "$QA_MIN_FREE_MB" ] 2>/dev/null; then
  QA_NOTE="deferred: low memory (${FREE_MB}MB free) — protecting the live composer"
  log "VALIDATE: /qa $QA_NOTE"
else
  log "VALIDATE: /qa (browser)…"
  QA_JSON="$RUNDIR/qa.json"
  set +e
  claude_lane "$QA_TIMEOUT" "Run /qa-only against this app to check the change works (report-only — do NOT edit any files).
If the change has no web-facing surface, or you cannot boot the app headless, that is NOT a failure —
just say so. When done, write JSON to the absolute path $QA_JSON:
{\"verdict\":\"pass\"|\"fail\"|\"deferred\",\"bugs\":[\"short\"],\"note\":\"e.g. no web surface affected / couldn't boot\"}
verdict=fail ONLY for real bugs you reproduced; verdict=deferred if there was nothing to test." \
    >"$RUNDIR/qa.log" 2>&1
  rc=$?; set -e
  # /qa is soft: a timeout or a headless-BLOCKED degrades to 'deferred', it never blocks the PR.
  git checkout -q -- . 2>/dev/null || true   # qa-only shouldn't edit, but never let stray edits ship
  if [ $rc -eq 124 ]; then QA_NOTE="deferred: /qa timed out after ${QA_TIMEOUT}s"
  elif phase_blocked "$RUNDIR/qa.log"; then QA_NOTE="deferred: /qa needed a human decision"
  elif [ -s "$QA_JSON" ]; then
    QV="$(jval '.verdict' <"$QA_JSON")"
    if [ "$QV" = "fail" ]; then
      QBUGS="$(node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const j=JSON.parse(d);process.stdout.write((j.bugs||[]).slice(0,3).join("; "))}catch{}})' <"$QA_JSON")"
      blocked "/qa found bug(s) in the running app: ${QBUGS:-see the QA report}. No PR opened; needs a fix."
    fi
    QA_NOTE="$(jval '.note' <"$QA_JSON")"; [ -n "$QA_NOTE" ] || QA_NOTE="ran clean"
  else
    QA_NOTE="deferred: /qa produced no report"
  fi
  log "/qa: $QA_NOTE"
fi

# --- 9. GATE PASSED → push the branch + open the PR (a human still merges) --------------------------
git push --quiet "https://x-access-token:${TICKET_GITHUB_TOKEN}@github.com/${REPO}.git" "$BRANCH"
log "pushed $BRANCH"
PR_BODY="Worked by the Foundry lane through the full RPIV loop (plan → implement → review → qa).

$SUMMARY

**Gate:** tests ✅ · /review ✅ ($RSTATUS) · /qa: $QA_NOTE
A human still reviews + merges (nothing merges or ships automatically)."
PR_JSON=$(gh_api -X POST "$API/repos/$REPO/pulls" \
  -d "$(node -e 'const[t,h,b,body]=process.argv.slice(1);process.stdout.write(JSON.stringify({title:t,head:h,base:b,body}))' \
        "ARCA: $SLUG (Foundry lane)" "$BRANCH" "$BASE_BRANCH" "$PR_BODY")")
PR_URL=$(printf '%s' "$PR_JSON" | jval '.html_url')
[ -n "$PR_URL" ] || fail "PR creation failed: $(printf '%s' "$PR_JSON" | jval '.message')"
log "opened PR $PR_URL"

# --- 10. RunReport: done (with the gate evidence) --------------------------------------------------
write_runreport "$SLUG" "opened_pr" "$SUMMARY — passed the lane's own gate (tests, /review $RSTATUS, /qa: $QA_NOTE)." "$PR_URL" "$STARTED"
log "done."
