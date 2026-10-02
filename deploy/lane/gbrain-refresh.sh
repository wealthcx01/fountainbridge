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

# 1b. does the brain hold every document the venture has? (FB-169) A brain holding a subset looks
#     healthy: the sync succeeds and searches return results. ARCA's whole Build department was
#     missing for a month that way. Checked every run, because the cause can be anything that makes
#     gbrain skip a file — a folder name it treats as build output was the one that bit.
#     The gap is written where the supervisor reads it, so each run's report says the brain is short.
GAP_FILE="$STATE_DIR/brain-corpus-gap"
# Every way out goes through here, so an incomplete brain fails the run — the timer's unit shows
# failed — instead of reporting "done." The index is still stamped: it IS current, just incomplete.
finish() {
  stamp_sync
  if [ -s "$GAP_FILE" ]; then
    say "done, but the brain is missing $GAP_COUNT of the venture's documents (listed above)."
    exit 3
  fi
  say "done."
  exit 0
}
LISTED="$(brain list --limit 5000 --source "$BRAIN_SOURCE" 2>/dev/null | cut -f1 || true)"
GAP="$(git -C "$REPO_DIR" ls-files context library | LISTED="$LISTED" node --input-type=module -e "
  import { readFileSync } from 'node:fs';
  import { corpusGap } from '$(dirname "$0")/brain-lib.mjs';
  const tracked = readFileSync(0, 'utf8').split('\\n');
  const g = corpusGap(tracked, process.env.LISTED.split('\\n'));
  console.log(g.missing.length + ' ' + g.corpus + (g.missing.length ? '\\n' + g.missing.join('\\n') : ''));
" 2>/dev/null || echo "?")"
GAP_COUNT="${GAP%% *}"; GAP_COUNT="${GAP_COUNT%%$'\n'*}"
if [ "$GAP_COUNT" = "0" ]; then
  rm -f "$GAP_FILE"
else
  mkdir -p "$STATE_DIR"; printf '%s\n' "$GAP" > "$GAP_FILE"
  say "BRAIN IS INCOMPLETE — it does not hold these documents, so no search can find them:"
  printf '%s\n' "$GAP" | tail -n +2 >&2
fi
# The same answer as a record the studio's Memory screen can show (FB-169). Written every time,
# including when nothing is missing, so the screen can tell a measured zero from "never checked".
# This unit holds no token; the lane carries the record to the state ref (run-once.sh).
printf '%s\n' "$GAP" | node "$(dirname "$0")/brain-corpus-record.mjs" write "$STATE_DIR/brain-corpus.json" \
  || say "WARN: could not write the record of what the brain can see — the studio will not hear of it"

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
  finish
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
    # gbrain names a page by its path (`context/sell/x`, read from the ARCA box). These read the
    # dash form only, so this pass tagged nothing until FB-169. Both are accepted; `product/` is
    # Build's folder, because gbrain skips any folder named `build` (brain-lib.mjs).
    context[-/]product[-/]*|library[-/]product[-/]*|context[-/]build[-/]*|library[-/]build[-/]*) dept=build ;;
    context[-/]sell[-/]*|library[-/]sell[-/]*)   dept=sell ;;
    context[-/]scale[-/]*|library[-/]scale[-/]*) dept=scale ;;
    *) continue ;;
  esac
  if brain tag "$slug" "dept:$dept" --source "$BRAIN_SOURCE" </dev/null >/dev/null 2>&1; then
    tagged=$((tagged + 1))
  fi
done <<< "$PAGES"
say "tagged $tagged department page(s)"

finish
