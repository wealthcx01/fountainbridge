#!/usr/bin/env bash
# Refresh the venture brain (FB-050) — keep the index tracking what actually merged.
#
# Run by foundry-brain-sync.timer, and once by install-gbrain.sh (with --full) to build the index.
# Standalone by design: it needs no GitHub token and no Claude auth, only gbrain + the worktree.
#
# DIVISION OF LABOUR. The LANE owns git: every wake, run-once.sh resets the worktree to
# origin/<base>, so what merged is on disk within a few minutes. The BRAIN owns the index: this
# script never pulls, checks out or cleans anything — it indexes what is on disk (`--no-pull`).
# That keeps a refresh from ever racing the lane's working tree.
#
# It also DEFERS while a lane run is in flight (worktree off the base branch): mid-ticket the tree
# holds uncommitted work-in-progress, which is not yet venture knowledge. The timer comes back.
#
# PGLite is single-writer, so the sync takes the same flock the read path (brain-query.mjs) takes.
#
# Usage: gbrain-refresh.sh [--full]
set -euo pipefail

: "${LANE_DIR:=/opt/foundry/lane}"
: "${REPO_DIR:=$LANE_DIR/arca}"
: "${BASE_BRANCH:=master}"
: "${BRAIN_SOURCE:=venture}"
: "${FOUNDRY_BRAIN_LOCK:=$LANE_DIR/state/gbrain.lock}"
: "${SYNC_TIMEOUT:=3600}"
: "${LOCK_WAIT:=900}"

FULL=""
[ "${1:-}" = "--full" ] && FULL="--full"

say() { echo "[brain-refresh $(date -u +%FT%TZ)] $*" >&2; }

command -v gbrain >/dev/null 2>&1 || { say "gbrain not installed — run install-gbrain.sh"; exit 1; }
[ -d "$REPO_DIR/.git" ] || { say "no venture repo at $REPO_DIR"; exit 1; }

mkdir -p "$(dirname "$FOUNDRY_BRAIN_LOCK")"

BRANCH="$(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
if [ "$BRANCH" != "$BASE_BRANCH" ]; then
  say "worktree is on '$BRANCH' (a lane run is in flight) — deferring to the next tick"
  exit 0
fi

# One gbrain invocation, serialised against readers and against a second refresh.
brain() { flock -w "$LOCK_WAIT" "$FOUNDRY_BRAIN_LOCK" timeout "$SYNC_TIMEOUT" gbrain "$@"; }

# 1. prose first — context/, library/, docs/tickets/: what the founder and the backlog say.
say "syncing prose (source=$BRAIN_SOURCE)…"
brain sync --source "$BRAIN_SOURCE" --no-pull $FULL || { say "prose sync failed"; exit 1; }

# 2. then code — so RESEARCH can find how something is already built, not just what was written
#    about it. A code pass failing must not lose the prose pass above.
say "syncing code…"
brain sync --source "$BRAIN_SOURCE" --strategy code --no-pull $FULL || say "WARN: code sync failed (prose is indexed)"

# 3. department partitions (D8). Retrieval partitions on the slug prefix (brain-lib.mjs), which is
#    what a lane's RESEARCH filters on. These tags are the human-inspectable form of the same fact:
#    `gbrain list --tag dept:sell` shows exactly what the Sell surface owns.
say "tagging department partitions…"
tagged=0
while IFS=$'\t' read -r slug _rest; do
  case "$slug" in
    context-build-*|library-build-*) dept=build ;;
    context-sell-*|library-sell-*)   dept=sell ;;
    context-scale-*|library-scale-*) dept=scale ;;
    *) continue ;;
  esac
  if brain tag "$slug" "dept:$dept" >/dev/null 2>&1; then tagged=$((tagged + 1)); fi
done < <(brain list -n 500 --source "$BRAIN_SOURCE" 2>/dev/null || true)
say "tagged $tagged department page(s)"

say "done."
