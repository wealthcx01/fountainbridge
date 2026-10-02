#!/usr/bin/env bash
# Runs ONE ticket on a temporary ticket machine (FB-239). Started by the machine's boot command, which
# fetched this lane at the studio's own version; the studio removes the machine afterwards whatever
# this script does.
#
# 1. collect this run's work from the studio, once, with the run's own token (worker-call.mjs start);
# 2. install only what the lane needs, and fetch the one repository this ticket belongs to;
# 3. hand the ticket to the same supervisor.sh a venture's own machine runs, so the work is unchanged;
# 4. tell the studio how it ended (worker-call.mjs finish), on EVERY exit.
#
# The stage is part of that report, and only "done" counts as a run that reached its end. A machine
# that fails while setting itself up reports "setup", with the last lines of its set-up log, and the
# founder's run report says so (CLAUDE.md #10). Before this, such a run was reported as a success.
#
# Never run by hand on a venture's own machine: it expects a machine that will be thrown away.
set -euo pipefail

LANE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Overridable only so the test can run this script in a scratch directory.
RUN_DIR="${FOUNDRY_RUN_DIR:-/opt/foundry/run}"
: "${FOUNDRY_STUDIO_URL:?the machine was started without FOUNDRY_STUDIO_URL}"
: "${FOUNDRY_RUN_ID:?the machine was started without FOUNDRY_RUN_ID}"
: "${FOUNDRY_RUN_TOKEN:?the machine was started without FOUNDRY_RUN_TOKEN}"
: "${FOUNDRY_VENTURE:?the machine was started without FOUNDRY_VENTURE}"
mkdir -p "$RUN_DIR/state"
export STATE_DIR="$RUN_DIR/state"
export REPO_DIR="$RUN_DIR/repo"
export SESSION_INDEX="$STATE_DIR/sessions.jsonl"
SETUP_LOG="$RUN_DIR/setup.log"
: > "$SETUP_LOG"

STAGE=setup
SKILLS=""
# Invoked by the EXIT trap below. Older shellcheck (CI) calls that SC2317, newer SC2329.
# shellcheck disable=SC2317,SC2329
finish() {
  local code=$?
  if command -v node >/dev/null 2>&1; then
    node "$LANE_DIR/worker-call.mjs" finish "$code" "$STAGE" "$SKILLS" "$SESSION_INDEX" "$SETUP_LOG" || true
  else
    # No Node yet (it failed to install): say at least where it stopped. Nothing here needs quoting.
    curl -fsS -m 30 -X POST -H "Authorization: Bearer $FOUNDRY_RUN_TOKEN" -H 'Content-Type: application/json' \
      -d "{\"venture\":\"$FOUNDRY_VENTURE\",\"exit\":$code,\"stage\":\"$STAGE\",\"log\":\"Node.js could not be installed on the machine.\"}" \
      "${FOUNDRY_STUDIO_URL%/}/api/machines/$FOUNDRY_RUN_ID/finish" >/dev/null || true
  fi
}
trap finish EXIT

say() { echo "[ticket-machine $(date -u +%FT%TZ)] $*" | tee -a "$SETUP_LOG" >&2; }
# Run a set-up step with its output kept in the set-up log, so a failure says why.
step() { say "$1"; shift; "$@" >>"$SETUP_LOG" 2>&1; }

# --- Node 20, the version the venture machines run (deploy/lane/README.md) -----------------------------
node_ok() { command -v node >/dev/null 2>&1 && node -e 'process.exit(+process.versions.node.split(".")[0] >= 20 ? 0 : 1)'; }
if ! node_ok; then
  step "installing Node.js 20" bash -c 'curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y -qq nodejs'
  node_ok || { say "Node.js 20 could not be installed"; exit 4; }
fi

# --- this run's work, collected once -------------------------------------------------------------------
step "collecting this run's work from the studio" node "$LANE_DIR/worker-call.mjs" start "$RUN_DIR/run.env"
set -a
# shellcheck disable=SC1091  # written at run time by worker-call.mjs; it does not exist here
. "$RUN_DIR/run.env"
set +a
: "${REPO:?the studio sent no REPO}" "${BASE_BRANCH:?the studio sent no BASE_BRANCH}"
: "${TICKET_SLUG:?the studio sent no TICKET_SLUG}" "${TICKET_PATH:?the studio sent no TICKET_PATH}"
: "${TICKET_GITHUB_TOKEN:?the studio sent no TICKET_GITHUB_TOKEN}"

# --- tools the lane needs -------------------------------------------------------------------------------
step "installing the lane's tools" bash -c 'apt-get update -qq && apt-get install -y -qq git curl unzip jq uuid-runtime ca-certificates'
if ! command -v claude >/dev/null 2>&1; then
  step "installing Claude Code" npm install -g --silent @anthropic-ai/claude-code
fi
if [ ! -d "${HOME:-/root}/.claude/skills/gstack" ]; then
  step "installing gstack (the review and QA guides the lane follows)" bash "$LANE_DIR/install-gstack.sh"
fi
export PATH="${HOME:-/root}/.bun/bin:$PATH"

# --- the one repository this ticket belongs to ----------------------------------------------------------
# The token is supplied for the clone and then removed from the stored address, the same rule the
# persistent lane follows (origin_url in foundry-lib.sh): nothing writes a credential into .git/config.
step "fetching $REPO" git clone --quiet --branch "$BASE_BRANCH" \
  "https://x-access-token:${TICKET_GITHUB_TOKEN}@github.com/${REPO}.git" "$REPO_DIR"
git -C "$REPO_DIR" remote set-url origin "https://github.com/${REPO}.git"
git -C "$REPO_DIR" config user.name "${GIT_AUTHOR_NAME:-Foundry lane}"
git -C "$REPO_DIR" config user.email "${GIT_AUTHOR_EMAIL:-lane@foundry.invalid}"

[ -f "$REPO_DIR/$TICKET_PATH" ] || { say "the ticket file $TICKET_PATH is not in $REPO on $BASE_BRANCH"; exit 3; }

# --- the work: the same supervisor the venture's own machine runs ----------------------------------------
# Stopped by `timeout` three minutes before the machine's deadline, so the end is still reported.
STAGE=work
LEFT=$(( ${FOUNDRY_EXPIRES_AT:-0} - $(date +%s) - 180 ))
[ "$LEFT" -gt 60 ] || LEFT=60
cd "$REPO_DIR"
set +e
timeout --signal=TERM --kill-after=60 "$LEFT" bash "$LANE_DIR/supervisor.sh" "$TICKET_SLUG" "$REPO_DIR/$TICKET_PATH"
WORK_EXIT=$?
set -e
# 124 and 137 are timeout's own codes: the work was cut off, which is not a run that reached its end.
if [ "$WORK_EXIT" -eq 124 ] || [ "$WORK_EXIT" -eq 137 ]; then
  say "the work was stopped at the machine's deadline"
  exit "$WORK_EXIT"
fi

# --- which guides it followed (FB-231) -------------------------------------------------------------------
STAGE=report
SKILLS=$(node "$LANE_DIR/skills-used.mjs" "$TICKET_SLUG" 2>/dev/null | tr -cd 'A-Za-z0-9 ._-' || true)
STAGE="done"
exit "$WORK_EXIT"
