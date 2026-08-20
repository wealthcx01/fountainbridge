#!/usr/bin/env bash
#
# sync-box.sh (FB-116) — put this repo's box-side files onto a venture box.
#
#   scripts/sync-box.sh root@chat.arca.bruntsfield.capital [--dry-run]
#
# ## Why this exists
#
# There has never been a way to do this. `provision-venture.sh` creates the box and clones the
# venture repos; `deploy/librechat/install.sh` stages the LibreChat recipe (FB-113). **Nothing has
# ever put `deploy/lane/*` anywhere.** Those files reached ARCA by hand, over months, and the fact
# was written down nowhere — which is why three tickets' worth of merged, tested work (FB-047's
# routine runner, FB-060's hand-off, FB-069's composer half) is running on no box at all.
#
# ## What makes it safe
#
# **It only ever writes files that exist in this repo, and it never deletes.** That is the whole
# safety argument, and it is structural rather than a list of exclusions to keep in step: a box's own
# state — `lane.env`, `brain.env`, `state/`, the cloned venture repos, `librechat/.env` — has no
# counterpart here, so there is no path by which this can touch it.
#
# It is idempotent, it reports exactly what changed, and it verifies by checksum afterwards rather
# than trusting that `scp` did what it said. A sync that reports success without checking is the
# failure this lane has met four times over (FB-112, FB-113, ARCA-34, and every entry in the
# box-install gotchas).
set -euo pipefail

HOST="${1:-}"
DRY_RUN=0
[ "${2:-}" = "--dry-run" ] && DRY_RUN=1
[ "${1:-}" = "--dry-run" ] && { echo "usage: $0 <user@host> [--dry-run]" >&2; exit 2; }

if [ -z "$HOST" ]; then
  echo "usage: $0 <user@host> [--dry-run]" >&2
  echo "  e.g. $0 root@chat.arca.bruntsfield.capital" >&2
  exit 2
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

green() { printf '\033[0;32m[sync]\033[0m %s\n' "$*"; }
warn()  { printf '\033[0;33m[sync]\033[0m %s\n' "$*" >&2; }
die()   { printf '\033[0;31m[sync]\033[0m %s\n' "$*" >&2; exit 1; }

# --- what ships -------------------------------------------------------------------------------
#
# The lane: everything in deploy/lane except its tests. Derived by listing the directory rather than
# naming files, so a new helper cannot be forgotten — the exact failure FB-112 was (a new module the
# box never received). __tests__ and *.test.mjs stay here: a box has no vitest and no reason to.
lane_files() {
  find deploy/lane -maxdepth 1 -type f ! -name '*.test.mjs' -printf '%P\n' | sort
}

# LibreChat: the recipe, the seeder, and every host path the compose file bind-mounts. Same
# derivation as install.sh's `compose_mounts` (FB-113) — the compose file is the list.
librechat_files() {
  {
    printf '%s\n' docker-compose.yml librechat.yaml seed.sh seed-agent.js
    sed -n 's|^[[:space:]]*-[[:space:]]*\(\./[^:]*\):.*|\1|p' deploy/librechat/docker-compose.yml \
      | sed 's|^\./||'
  } | sort -u
}

# --- preflight --------------------------------------------------------------------------------
command -v ssh >/dev/null || die "ssh not found"
ssh -o BatchMode=yes -o ConnectTimeout=10 "$HOST" true 2>/dev/null \
  || die "cannot reach $HOST over ssh (BatchMode) — check the host and your key"

MISSING=0
while IFS= read -r f; do
  [ -f "deploy/lane/$f" ] || { warn "MISSING deploy/lane/$f"; MISSING=1; }
done < <(lane_files)
while IFS= read -r f; do
  [ -f "deploy/librechat/$f" ] || { warn "MISSING deploy/librechat/$f"; MISSING=1; }
done < <(librechat_files)
[ "$MISSING" -eq 0 ] || die "refusing to sync: the files above are named but not present"

# --- compare ----------------------------------------------------------------------------------
# md5 both sides first so the run can say what it CHANGED, not merely what it sent. An operator
# reading "12 files synced" learns nothing; "3 changed, 9 already current" is a fact.
local_sums()  { ( cd "$1" && xargs -r md5sum 2>/dev/null ) ; }
remote_sums() { ssh -o BatchMode=yes "$HOST" "cd '$1' 2>/dev/null && xargs -r md5sum 2>/dev/null || true" ; }

# LC_ALL=C throughout: `sort` and `comm` must agree on collation or comm rejects its own input as
# unsorted, and the filenames here contain hyphens and dots that locale rules order differently.
changed_list() { # dir remote_dir  (reads file list on stdin)
  local dir="$1" remote="$2" list; list=$(cat)
  local before after
  before=$(printf '%s\n' "$list" | remote_sums "$remote" | awk '{print $2" "$1}' | LC_ALL=C sort)
  after=$(printf '%s\n' "$list" | local_sums "$dir"       | awk '{print $2" "$1}' | LC_ALL=C sort)
  LC_ALL=C comm -13 <(printf '%s\n' "$before") <(printf '%s\n' "$after") | awk '{print $1}'
}

LANE_CHANGED=$(lane_files | changed_list deploy/lane /opt/foundry/lane || true)
LC_CHANGED=$(librechat_files | changed_list deploy/librechat /opt/foundry/librechat || true)

LANE_N=$(printf '%s' "$LANE_CHANGED" | grep -c . || true)
LC_N=$(printf '%s' "$LC_CHANGED" | grep -c . || true)
green "lane: $LANE_N file(s) differ · librechat: $LC_N file(s) differ"
# `if` rather than `[ … ] && …`: under `set -e` a false test at the head of an && list is a
# fragile way to write "maybe print this", and the failure mode is the script exiting silently
# with nothing said — which on a sync tool reads as success.
if [ "$LANE_N" -gt 0 ]; then printf '%s\n' "$LANE_CHANGED" | sed 's|^|  lane/|'; fi
if [ "$LC_N" -gt 0 ]; then printf '%s\n' "$LC_CHANGED" | sed 's|^|  librechat/|'; fi

if [ "$((LANE_N + LC_N))" -eq 0 ]; then
  green "already current — nothing to do"
  exit 0
fi

if [ "$DRY_RUN" -eq 1 ]; then
  green "dry run — nothing was written"
  exit 0
fi

# --- push -------------------------------------------------------------------------------------
# tar over ssh rather than scp per file: one round trip, and it preserves the directory structure of
# the *-mcp/ subdirectories without needing to mkdir each one by hand.
push() { # local_dir remote_dir  (reads file list on stdin)
  local dir="$1" remote="$2" list; list=$(cat)
  [ -n "$list" ] || return 0
  ssh -o BatchMode=yes "$HOST" "mkdir -p '$remote'"
  printf '%s\n' "$list" | tar -C "$dir" -cf - -T - \
    | ssh -o BatchMode=yes "$HOST" "tar -C '$remote' -xf -"
}

# `if` rather than `… | grep . | push`: with an empty list, `printf '%s\n' ""` sends one blank line
# into `grep .`, which exits 1 — and under `set -euo pipefail` that killed the script HERE, after the
# first push and before the verify. Caught on the first real run against ARCA: the lane files landed
# correctly, and every line after this point (the checksum verify, the systemd reload, the "you still
# need to re-seed" warnings) never ran. Work done, verification skipped, silence reading as success —
# which is the exact failure this script was written to end.
if [ -n "$LANE_CHANGED" ]; then printf '%s\n' "$LANE_CHANGED" | push deploy/lane /opt/foundry/lane; fi
if [ -n "$LC_CHANGED" ]; then printf '%s\n' "$LC_CHANGED" | push deploy/librechat /opt/foundry/librechat; fi

# Assert the exec bit rather than trusting the transfer to carry it.
ssh -o BatchMode=yes "$HOST" "chmod +x /opt/foundry/lane/*.sh /opt/foundry/librechat/*.sh 2>/dev/null || true"

# --- verify -----------------------------------------------------------------------------------
# The point of the whole script. Re-read the far side and compare; a sync that reports success
# without checking is exactly the class of failure this exists to end.
STILL=$( { lane_files | changed_list deploy/lane /opt/foundry/lane; \
           librechat_files | changed_list deploy/librechat /opt/foundry/librechat; } || true )
if [ -n "$STILL" ]; then
  printf '%s\n' "$STILL" | sed 's|^|  |' >&2
  die "these files still differ after the sync — the box does NOT have what this repo has"
fi
green "verified: the box matches this repo"

# --- systemd ------------------------------------------------------------------------------------
# A changed unit file that nobody reloaded is a unit that did not change. Only reload when one
# actually moved, so a routine sync does not restart things for no reason.
if printf '%s\n' "$LANE_CHANGED" | grep -qE '\.(service|timer)$'; then
  green "unit file(s) changed — reloading systemd"
  ssh -o BatchMode=yes "$HOST" "cp /opt/foundry/lane/*.service /opt/foundry/lane/*.timer /etc/systemd/system/ 2>/dev/null || true; systemctl daemon-reload"
  warn "units were reloaded, but nothing was restarted — restart the ones you mean to, deliberately"
fi

# --- what the operator still has to decide -------------------------------------------------------
if printf '%s\n' "$LC_CHANGED" | grep -qE '^(seed-agent\.js|librechat\.yaml)$'; then
  warn "seed-agent.js or librechat.yaml changed — the composer will not pick that up until you re-seed:"
  warn "    ssh $HOST 'cd /opt/foundry/librechat && ./seed.sh && docker compose restart api'"
fi
if printf '%s\n' "$LC_CHANGED" | grep -qE '^docker-compose\.yml$'; then
  warn "docker-compose.yml changed — a restart will NOT pick up new mounts:"
  warn "    ssh $HOST 'cd /opt/foundry/librechat && docker compose up -d'"
fi

green "done."
