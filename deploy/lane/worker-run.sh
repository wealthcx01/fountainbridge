#!/usr/bin/env bash
# Runs ONE ticket on a temporary ticket machine (FB-239). Sent to the machine by ticket-machine.mjs and
# run once; the machine is destroyed afterwards whatever this script does.
#
# It sets up only what this ticket needs — the one repository, the lane, gstack — then hands the
# ticket to the same supervisor.sh the persistent machine uses, so the work itself is unchanged.
# Last, it writes result.json, which is how the persistent machine learns the run reached its end.
#
# Never run by hand on a venture's own machine: it clones into /opt/foundry/run and expects a machine
# that will be thrown away.
set -euo pipefail

RUN_DIR=/opt/foundry/run
LANE_DIR=/opt/foundry/lane
set -a
# shellcheck disable=SC1091  # run.env is written to the machine at run time; it does not exist here
. "$RUN_DIR/run.env"
set +a
: "${REPO:?run.env has no REPO}" "${BASE_BRANCH:?run.env has no BASE_BRANCH}"
: "${TICKET_SLUG:?run.env has no TICKET_SLUG}" "${TICKET_PATH:?run.env has no TICKET_PATH}"
: "${TICKET_GITHUB_TOKEN:?run.env has no TICKET_GITHUB_TOKEN}"

export STATE_DIR="$RUN_DIR/state"
export REPO_DIR="$RUN_DIR/repo"
export SESSION_INDEX="$STATE_DIR/sessions.jsonl"
mkdir -p "$STATE_DIR"

STAGE=setup
SKILLS=""
# Invoked by the EXIT trap below. Older shellcheck (CI) calls that SC2317, newer SC2329.
# shellcheck disable=SC2317,SC2329
finish() {
  local code=$?
  # A JSON line the persistent machine can read back. Written on every exit, so a run that breaks
  # in set-up says where it broke rather than leaving nothing.
  printf '{"exit":%d,"stage":"%s","skills":"%s","finished_at":"%s"}\n' \
    "$code" "$STAGE" "$SKILLS" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$RUN_DIR/result.json"
}
trap finish EXIT

say() { echo "[ticket-machine $(date -u +%FT%TZ)] $*" >&2; }

# --- tools the lane needs ------------------------------------------------------------------------------
if ! command -v claude >/dev/null 2>&1; then
  say "installing Claude Code"
  npm install -g --silent @anthropic-ai/claude-code >/dev/null
fi
if [ ! -d "${HOME:-/root}/.claude/skills/gstack" ]; then
  say "installing gstack (the review and QA guides the lane follows)"
  bash "$LANE_DIR/install-gstack.sh" >/dev/null
fi

# --- the one repository this ticket belongs to ----------------------------------------------------------
# The token is supplied for the clone and then removed from the stored address, the same rule the
# persistent lane follows (origin_url in foundry-lib.sh): nothing writes a credential into .git/config.
say "fetching $REPO"
git clone --quiet --branch "$BASE_BRANCH" \
  "https://x-access-token:${TICKET_GITHUB_TOKEN}@github.com/${REPO}.git" "$REPO_DIR"
git -C "$REPO_DIR" remote set-url origin "https://github.com/${REPO}.git"
git -C "$REPO_DIR" config user.name "${GIT_AUTHOR_NAME:-Foundry lane}"
git -C "$REPO_DIR" config user.email "${GIT_AUTHOR_EMAIL:-lane@foundry.invalid}"

[ -f "$REPO_DIR/$TICKET_PATH" ] || { say "ticket file $TICKET_PATH is not in $REPO@$BASE_BRANCH"; exit 3; }

# --- the work: exactly what the persistent machine would have run ---------------------------------------
STAGE=work
cd "$REPO_DIR"
set +e
bash "$LANE_DIR/supervisor.sh" "$TICKET_SLUG" "$REPO_DIR/$TICKET_PATH"
WORK_EXIT=$?
set -e

# --- which guides it followed (FB-231), for the persistent machine's log ---------------------------------
STAGE=report
SKILLS=$(node "$LANE_DIR/skills-used.mjs" "$TICKET_SLUG" 2>/dev/null | tr -cd 'A-Za-z0-9 ._-' || true)
STAGE="done"
exit "$WORK_EXIT"
