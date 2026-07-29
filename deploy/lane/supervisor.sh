#!/usr/bin/env bash
# Foundry lane supervisor (FB-039 spike) — the engine behind the composer.
#
# Wakes, claims a workable ticket via a branch-create compare-and-swap (the atomic lock from
# docs/founder-to-lane-execution.md §4), runs a Claude Code LANE to do the work on that branch,
# opens a PR (a human still merges — non-negotiable 2), and writes a RunReport to the direct-push
# `foundry-state` ref (§6) so the studio can surface progress (nothing fails silently — #10).
#
# SAFETY (§8): this box holds NO send/deploy/payment creds — the lane can only write to the repo and
# open a PR. It can never send, deploy, or grant an approval. External actions are a separate gated
# executor's job (FB-044), not the lane's.
#
# AUTH: ANTHROPIC_API_KEY is used here for the spike. Production preference is shared Claude Max via a
# `claude setup-token` (John, 2026-07-29) — swap CLAUDE_CODE_OAUTH_TOKEN in and drop the API key.
#
# Usage (spike): supervisor.sh <slug> <ticket-file>
#   <slug>        lowercase-kebab id for the branch (foundry/<slug>)
#   <ticket-file> path to the ticket markdown the lane implements
set -euo pipefail

: "${REPO:=wealthcx01/arca}"
: "${REPO_DIR:=/opt/foundry/lane/arca}"
: "${BASE_BRANCH:=master}"
: "${TICKET_GITHUB_TOKEN:?need a repo-write token (lane identity)}"
: "${ANTHROPIC_API_KEY:?need Claude auth (spike) — production: CLAUDE_CODE_OAUTH_TOKEN for Max}"
STATE_REF="foundry-state"
API="https://api.github.com"

SLUG="${1:?usage: supervisor.sh <slug> <ticket-file>}"
TICKET_FILE="${2:?usage: supervisor.sh <slug> <ticket-file>}"
BRANCH="foundry/${SLUG}"
NOW() { date -u +%Y-%m-%dT%H:%M:%SZ; }
STARTED="$(NOW)"

gh_api() { curl -sS -H "Authorization: Bearer ${TICKET_GITHUB_TOKEN}" -H "Accept: application/vnd.github+json" \
                 -H "X-GitHub-Api-Version: 2022-11-28" "$@"; }
jval() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{process.stdout.write(String(eval('JSON.parse(d)'+process.argv[1])??''))}catch{process.stdout.write('')}})" "$1"; }

log() { echo "[lane $(NOW)] $*" >&2; }

# --- write a RunReport to the foundry-state ref (create the ref if missing) -------------------------
write_runreport() {
  local status="$1" summary="$2" pr_url="${3:-}"
  local report; report=$(node -e '
    const [status,summary,pr,slug,started,repo]=process.argv.slice(1);
    process.stdout.write(JSON.stringify({ticket:slug,lane:"arca",status,summary,pr_url:pr||undefined,started,finished:new Date().toISOString().replace(/\.\d+Z$/,"Z"),repo},null,2));
  ' "$status" "$summary" "$pr_url" "$SLUG" "$STARTED" "$REPO")
  # ensure the state ref exists (point it at base on first use)
  local base_sha; base_sha=$(gh_api "$API/repos/$REPO/git/ref/heads/$BASE_BRANCH" | jval '.object.sha')
  if ! gh_api "$API/repos/$REPO/git/ref/heads/$STATE_REF" | grep -q '"ref"'; then
    gh_api -X POST "$API/repos/$REPO/git/refs" -d "{\"ref\":\"refs/heads/$STATE_REF\",\"sha\":\"$base_sha\"}" >/dev/null
    log "created state ref $STATE_REF"
  fi
  local path; path="runreports/${SLUG}-$(date -u +%Y%m%dT%H%M%SZ).json"
  local existing_sha; existing_sha=$(gh_api "$API/repos/$REPO/contents/$path?ref=$STATE_REF" | jval '.sha')
  local b64; b64=$(printf '%s' "$report" | base64 -w0)
  local body="{\"message\":\"runreport: $SLUG ($status)\",\"content\":\"$b64\",\"branch\":\"$STATE_REF\""
  [ -n "$existing_sha" ] && body="$body,\"sha\":\"$existing_sha\""
  body="$body}"
  gh_api -X PUT "$API/repos/$REPO/contents/$path" -d "$body" >/dev/null
  log "runreport → $STATE_REF:$path ($status)"
}

fail() { write_runreport "failed" "$1"; log "FAILED: $1"; exit 1; }

# --- 1. CLAIM: branch-create compare-and-swap (the atomic lock) ------------------------------------
BASE_SHA=$(gh_api "$API/repos/$REPO/git/ref/heads/$BASE_BRANCH" | jval '.object.sha')
[ -n "$BASE_SHA" ] || fail "could not read $BASE_BRANCH head"
CLAIM_CODE=$(gh_api -o /dev/null -w '%{http_code}' -X POST "$API/repos/$REPO/git/refs" \
  -d "{\"ref\":\"refs/heads/$BRANCH\",\"sha\":\"$BASE_SHA\"}")
if [ "$CLAIM_CODE" = "422" ]; then log "ticket already claimed ($BRANCH exists) — yielding"; exit 0; fi
[ "$CLAIM_CODE" = "201" ] || fail "claim failed (HTTP $CLAIM_CODE)"
log "claimed $BRANCH"
write_runreport "working" "Lane claimed the ticket and started work."

# --- 2. work the ticket locally on the claimed branch ----------------------------------------------
cd "$REPO_DIR"
git fetch --quiet origin "$BRANCH"
git checkout --quiet -B "$BRANCH" "origin/$BRANCH"

# --- 3. run the LANE (Claude Code) to implement exactly this ticket ---------------------------------
PROMPT="You are a Foundry engineering lane on the arca repository, working ONE ticket. Implement exactly
the ticket below, making the smallest correct change. Edit files in the working tree only — do NOT
commit, push, or open a PR (the supervisor does that). Do NOT run any deploy or send commands. When
done, print a one-line plain-English summary of what you changed.

TICKET:
$(cat "$TICKET_FILE")"
log "running lane (Claude Code)…"
SUMMARY=$(ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" claude -p "$PROMPT" \
  --permission-mode acceptEdits --output-format text 2>>/tmp/lane-claude.err | tail -1 || true)
[ -n "$SUMMARY" ] || SUMMARY="Lane completed the ticket."

# --- 4. commit + push the branch -------------------------------------------------------------------
git add -A
if git diff --cached --quiet; then fail "the lane produced no changes"; fi
git -c user.email="lane@bruntsfield.capital" -c user.name="Foundry Lane" \
    commit -q -m "ARCA: $SLUG (worked by the Foundry lane)"
git push --quiet "https://x-access-token:${TICKET_GITHUB_TOKEN}@github.com/${REPO}.git" "$BRANCH"
log "pushed $BRANCH"

# --- 5. open the PR (a human merges — the gate) ----------------------------------------------------
PR_JSON=$(gh_api -X POST "$API/repos/$REPO/pulls" \
  -d "$(node -e 'const[t,h,b,body]=process.argv.slice(1);process.stdout.write(JSON.stringify({title:t,head:h,base:b,body}))' \
        "ARCA: $SLUG (Foundry lane)" "$BRANCH" "$BASE_BRANCH" "Worked by the Foundry lane. $SUMMARY

A human still reviews + merges (nothing merges or ships automatically).")")
PR_URL=$(printf '%s' "$PR_JSON" | jval '.html_url')
[ -n "$PR_URL" ] || fail "PR creation failed: $(printf '%s' "$PR_JSON" | jval '.message')"
log "opened PR $PR_URL"

# --- 6. RunReport: done ----------------------------------------------------------------------------
write_runreport "opened_pr" "$SUMMARY" "$PR_URL"
log "done."
