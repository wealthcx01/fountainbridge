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

: "${STATE_DIR:=$LANE_DIR/state}"
LAST_SYNC_FILE="$STATE_DIR/brain-last-sync"

say() { echo "[brain-refresh $(date -u +%FT%TZ)] $*" >&2; }

# Record when the index was last actually brought up to date. Without this, an index frozen for days
# — every tick deferring because an aborted run left the worktree on a claim branch — looks exactly
# like a healthy one: timer green, unit "success", and a PR that tells the founder the work was
# planned from current venture knowledge. The lane reads this stamp to say otherwise (#10).
stamp_sync() { mkdir -p "$STATE_DIR" 2>/dev/null || true; date -u +%s > "$LAST_SYNC_FILE" 2>/dev/null || true; }

command -v gbrain >/dev/null 2>&1 || { say "gbrain not installed — run install-gbrain.sh"; exit 1; }
[ -d "$REPO_DIR/.git" ] || { say "no venture repo at $REPO_DIR"; exit 1; }

mkdir -p "$(dirname "$FOUNDRY_BRAIN_LOCK")"

# Re-assert the local exclude every run, not just at install. It lives in .git/info/exclude, which
# does NOT survive the re-clone the bring-up documents — and without it the lane's `git add -A`
# would sweep a gbrain artefact into a founder-facing PR.
EXCLUDE="$REPO_DIR/.git/info/exclude"
if [ -d "$(dirname "$EXCLUDE")" ] && ! grep -qxF '.gbrain-source' "$EXCLUDE" 2>/dev/null; then
  printf '.gbrain-source\n.gbrain/\n' >> "$EXCLUDE"
  say "re-asserted the gbrain exclude in $EXCLUDE"
fi

BRANCH="$(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
if [ "$BRANCH" != "$BASE_BRANCH" ]; then
  say "worktree is on '$BRANCH' (a lane run is in flight) — deferring to the next tick"
  exit 0
fi

# One gbrain invocation, serialised against readers and against a second refresh.
brain() { flock -w "$LOCK_WAIT" "$FOUNDRY_BRAIN_LOCK" timeout "$SYNC_TIMEOUT" gbrain "$@"; }

# 1. prose first — context/, library/, docs/tickets/: what the founder and the backlog say.
say "syncing prose (source=$BRAIN_SOURCE)…"
SYNC_OUT="$(brain sync --source "$BRAIN_SOURCE" --no-pull $FULL)" || { say "prose sync failed"; exit 1; }
printf '%s\n' "$SYNC_OUT" | tail -3 >&2

# 2. then code — so RESEARCH can find how something is already built, not just what was written
#    about it. A code pass failing must not lose the prose pass above.
say "syncing code…"
brain sync --source "$BRAIN_SOURCE" --strategy code --no-pull $FULL || say "WARN: code sync failed (prose is indexed)"

# 3. department partitions (D8). Retrieval partitions on the slug prefix (brain-lib.mjs), which is
#    what a lane's RESEARCH filters on. These tags are the human-inspectable form of the same fact:
#    `gbrain list --tag dept:sell` shows exactly what the Sell surface owns.
#
#    Skipped when the sync changed nothing. The pass costs one gbrain process per departmental page,
#    and this script runs on EVERY lane wake (~5 min) — re-tagging an unchanged set would burn a
#    process per page, per page, forever, on a 2 GB box that is also serving the founder's composer.
if [ -z "$FULL" ] && printf '%s' "$SYNC_OUT" | grep -q 'No syncable changes'; then
  say "nothing changed — skipping the tagging pass"
  stamp_sync
  say "done."
  exit 0
fi
say "tagging department partitions…"
# Capture the listing FIRST, outside the loop. Feeding the loop from `< <(brain list …)` held the
# lock for as long as that process lived, while every `brain tag` in the body waited on the same
# lock — a nested self-block that only worked while the output fit in a pipe buffer. Capturing also
# stops the loop's stdin from being consumed by a child.
# `--limit`, not `-n`: gbrain ignores `-n` and silently returns its default page (verified on
# 0.42.x — `-n 3` returns 50 rows, `--limit 3` returns 3), which would have quietly left most
# departmental pages untagged while reporting success.
PAGES="$(brain list --limit 500 --source "$BRAIN_SOURCE" 2>/dev/null || true)"
tagged=0
while IFS=$'\t' read -r slug _rest; do
  case "$slug" in
    context-build-*|library-build-*) dept=build ;;
    context-sell-*|library-sell-*)   dept=sell ;;
    context-scale-*|library-scale-*) dept=scale ;;
    *) continue ;;
  esac
  if brain tag "$slug" "dept:$dept" --source "$BRAIN_SOURCE" </dev/null >/dev/null 2>&1; then
    tagged=$((tagged + 1))
  fi
done <<< "$PAGES"
say "tagged $tagged department page(s)"

stamp_sync
say "done."
