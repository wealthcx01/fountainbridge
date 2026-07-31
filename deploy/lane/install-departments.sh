#!/usr/bin/env bash
# Clone a venture's department repos onto its lane box (FB-045).
#
# Before this, a box served one repo: the product. Sell and Scale existed on the founder's board and
# in the manifest, but no lane worked them. This clones each department's repo beside the product one
# and writes the FOUNDRY_DEPARTMENTS line the lane reads, so one wake can pick up a marketing ticket
# as readily as an engineering one.
#
# Idempotent: an already-cloned department is fetched, not re-cloned, and the env line is rewritten
# rather than appended (so running this twice does not leave two of them, with the stale one winning).
#
# Usage:
#   FOUNDRY_DEPARTMENTS="build:wealthcx01/arca:master:pr sell:wealthcx01/arca-marketing:main:activegraph" \
#     ./install-departments.sh
#
# Reads TICKET_GITHUB_TOKEN from lane.env for private clones. It is never echoed, and never written
# into a git remote — the remote stays tokenless and the token is supplied per-fetch by the lane.
set -euo pipefail

LANE_HOME="${LANE_HOME:-/opt/foundry/lane}"
LANE_ENV="${LANE_ENV:-$LANE_HOME/lane.env}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

say() { echo "[install-departments] $*"; }
die() { echo "[install-departments] ERROR: $*" >&2; exit 1; }

[ -d "$LANE_HOME" ] || die "$LANE_HOME does not exist — install the lane first"

# Prefer an explicit FOUNDRY_DEPARTMENTS from the environment; otherwise take the one already in
# lane.env, so re-running with no arguments repairs an existing install rather than wiping it.
if [ -z "${FOUNDRY_DEPARTMENTS:-}" ] && [ -f "$LANE_ENV" ]; then
  FOUNDRY_DEPARTMENTS="$(sed -n 's/^FOUNDRY_DEPARTMENTS=//p' "$LANE_ENV" | tail -1 | sed 's/^"//; s/"$//')"
fi
[ -n "${FOUNDRY_DEPARTMENTS:-}" ] || die "set FOUNDRY_DEPARTMENTS='id:owner/repo:base:gate ...'"

# The token is only needed for private repos, but every venture repo here is private.
if [ -z "${TICKET_GITHUB_TOKEN:-}" ] && [ -f "$LANE_ENV" ]; then
  # shellcheck disable=SC1090
  TICKET_GITHUB_TOKEN="$(sed -n 's/^TICKET_GITHUB_TOKEN=//p' "$LANE_ENV" | tail -1 | sed 's/^"//; s/"$//')"
fi
[ -n "${TICKET_GITHUB_TOKEN:-}" ] || die "no TICKET_GITHUB_TOKEN (in the environment or $LANE_ENV) — a private department repo cannot be cloned"

FAILED=0
# shellcheck disable=SC2086
for entry in $FOUNDRY_DEPARTMENTS; do
  id="$(printf '%s' "$entry" | cut -d: -f1)"
  repo="$(printf '%s' "$entry" | cut -d: -f2)"
  base="$(printf '%s' "$entry" | cut -d: -f3)"
  gate="$(printf '%s' "$entry" | cut -d: -f4)"
  if [ -z "$id" ] || [ -z "$repo" ] || [ -z "$base" ] || [ -z "$gate" ]; then
    say "SKIP malformed entry '$entry' (expected id:owner/repo:base:gate)"; FAILED=1; continue
  fi
  dir="$LANE_HOME/$(printf '%s' "$repo" | cut -d/ -f2)"

  if [ -d "$dir/.git" ]; then
    say "$id: $repo already cloned at $dir — fetching"
    git -C "$dir" fetch --quiet "https://x-access-token:${TICKET_GITHUB_TOKEN}@github.com/${repo}.git" \
      "+refs/heads/$base:refs/remotes/origin/$base" \
      || { say "$id: FETCH FAILED for $repo"; FAILED=1; continue; }
  else
    say "$id: cloning $repo → $dir"
    if ! git clone --quiet "https://x-access-token:${TICKET_GITHUB_TOKEN}@github.com/${repo}.git" "$dir"; then
      say "$id: CLONE FAILED for $repo — the lane will report this department as unconfigured"; FAILED=1; continue
    fi
    # Strip the token out of the stored remote. A clone URL with credentials in it lands in
    # .git/config in plaintext and in every `git remote -v` a future operator runs.
    git -C "$dir" remote set-url origin "https://github.com/${repo}.git"
  fi

  # gbrain must never index into a venture worktree, and the lane's own scratch must never reach a
  # founder's PR (FB-050's lesson, applied to every new department rather than only the first).
  grep -qxF '.foundry-proposal.json' "$dir/.git/info/exclude" 2>/dev/null \
    || echo '.foundry-proposal.json' >> "$dir/.git/info/exclude"

  say "$id: ready ($repo, base $base, gate $gate)"
done

# Write the department list into lane.env so the systemd unit picks it up on the next wake. Rewritten
# in place: an appended duplicate would be the line that wins, and a stale one would silently send the
# lane at the wrong branch.
if [ -f "$LANE_ENV" ]; then
  tmp="$(mktemp)"
  grep -v '^FOUNDRY_DEPARTMENTS=' "$LANE_ENV" > "$tmp" || true
  printf 'FOUNDRY_DEPARTMENTS="%s"\n' "$FOUNDRY_DEPARTMENTS" >> "$tmp"
  # Preserve the original mode; lane.env holds tokens and must not widen to 0644 on rewrite.
  chmod --reference="$LANE_ENV" "$tmp" 2>/dev/null || chmod 600 "$tmp"
  mv "$tmp" "$LANE_ENV"
  say "wrote FOUNDRY_DEPARTMENTS to $LANE_ENV"
else
  say "no $LANE_ENV — set FOUNDRY_DEPARTMENTS in the lane's environment yourself"
fi

[ -f "$SCRIPT_DIR/proposal-check.mjs" ] \
  || say "WARNING: proposal-check.mjs is not installed beside this script — a gated department cannot file a proposal"

if [ "$FAILED" = 1 ]; then
  say "finished WITH FAILURES — at least one department is not usable (see above)"
  exit 1
fi
say "all departments ready."
