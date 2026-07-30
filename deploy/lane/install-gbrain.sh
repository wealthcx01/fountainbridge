#!/usr/bin/env bash
# Install the venture BRAIN on a venture box (FB-050) — gbrain indexing the venture repo, so the
# lane's RESEARCH step and the founder's composer both answer from everything the venture knows
# (D8: `context/`, `library/`, `docs/tickets/`, code) instead of re-reading raw files.
#
# Idempotent; run once per box as root, re-run to repair/repin. Design: docs/venture-brain.md.
#
# WHAT IT SETS UP
#   1. gbrain (pinned rev), with a LOCAL PGLite brain at /opt/foundry/brain — no external database.
#   2. The venture repo registered as a gbrain SOURCE, indexed prose-first then code.
#   3. A read-only brain bridge (systemd) so the composer's container can query it.
#   4. A refresh timer so the index tracks what merges.
#
# EMBEDDINGS — D1 (isolation). The default is LOCAL: Ollama on this box, so the venture's own
# knowledge is never sent to a third party to be embedded, and there is no per-query cost. This
# matches FB-034, where the composer's RAG deliberately runs sentence-transformers on the box for the
# same reason. It costs ~1 GB of disk and a few hundred MB of RAM while embedding.
# To use a hosted embedder instead (smaller footprint, but venture content leaves the box and you
# need that provider's key in the environment):
#   GBRAIN_EMBEDDING_MODEL=openai:text-embedding-3-large GBRAIN_EMBEDDING_DIMS=1536 ./install-gbrain.sh
set -euo pipefail

# Recorded rev (v0.42.67.0). gbrain installs from git, so — like install-gstack.sh's GSTACK_PIN — the
# box runs an exact commit, never a floating master. Bump deliberately to upgrade.
: "${GBRAIN_PIN:=c6dc0adf26a2d20df1147d2ec87c8922ca86d410}"
: "${GBRAIN_REPO:=github:garrytan/gbrain}"

: "${LANE_DIR:=/opt/foundry/lane}"
: "${REPO_DIR:=$LANE_DIR/arca}"          # the venture worktree the lane already keeps up to date
: "${BASE_BRANCH:=master}"               # the refresh only indexes a worktree sitting on this branch
: "${BRAIN_DIR:=/opt/foundry/brain}"     # the brain's OWN storage — never inside the venture worktree
: "${BRAIN_SOURCE:=venture}"             # gbrain source id for this venture's repo
: "${BRAIN_ENV:=$LANE_DIR/brain.env}"
: "${LIBRECHAT_DIR:=/opt/foundry/librechat}"
: "${GBRAIN_EMBEDDING_MODEL:=ollama:nomic-embed-text}"
: "${GBRAIN_EMBEDDING_DIMS:=768}"
: "${OLLAMA_BASE_URL:=http://localhost:11434/v1}"
export OLLAMA_BASE_URL

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
say() { echo "[install-gbrain] $*"; }
die() { echo "[install-gbrain] ERROR: $*" >&2; exit 1; }

[ -d "$REPO_DIR/.git" ] || die "no venture repo at $REPO_DIR — run the lane bring-up first (README)."

# --- 1. bun (gbrain's runtime; install-gstack.sh may already have put it here) ----------------------
export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"
if ! command -v bun >/dev/null 2>&1; then
  say "installing bun…"
  curl -fsSL https://bun.sh/install | bash
fi
command -v bun >/dev/null 2>&1 || die "bun install failed — ensure unzip is present"

# --- 2. gbrain, pinned ------------------------------------------------------------------------------
say "installing gbrain @ ${GBRAIN_PIN:0:8}…"
bun install -g "${GBRAIN_REPO}#${GBRAIN_PIN}"
command -v gbrain >/dev/null 2>&1 || die "gbrain not on PATH after install (looked in $BUN_INSTALL/bin)"
say "gbrain $(gbrain version 2>/dev/null | head -1)"

# --- 3. local embeddings (default) ------------------------------------------------------------------
case "$GBRAIN_EMBEDDING_MODEL" in
  ollama:*)
    OLLAMA_MODEL="${GBRAIN_EMBEDDING_MODEL#ollama:}"
    if ! command -v ollama >/dev/null 2>&1; then
      say "installing Ollama (local embeddings — venture content stays on this box)…"
      curl -fsSL https://ollama.com/install.sh | sh
    fi
    systemctl enable --now ollama 2>/dev/null || true
    # The service needs a moment before it will accept a pull on a cold box.
    for _ in $(seq 1 15); do curl -sf http://localhost:11434/api/tags >/dev/null 2>&1 && break; sleep 2; done
    say "pulling embedding model $OLLAMA_MODEL…"
    ollama pull "$OLLAMA_MODEL" || die "could not pull $OLLAMA_MODEL — the brain cannot embed without it"
    ;;
  *)
    say "WARNING: embedding model '$GBRAIN_EMBEDDING_MODEL' is hosted — this venture's context,"
    say "         library and code will be sent to that provider to be embedded (a deliberate"
    say "         departure from the on-box posture in FB-034/D1). Its API key must be in the env."
    ;;
esac

# --- 4. the brain itself (local PGLite, its own directory) ------------------------------------------
mkdir -p "$BRAIN_DIR"
if [ -f "$HOME/.gbrain/config.json" ]; then
  say "brain already initialised — leaving it alone (re-init would need --force)"
else
  say "creating the local brain (PGLite, $GBRAIN_EMBEDDING_MODEL)…"
  ( cd "$BRAIN_DIR" && gbrain init --pglite \
      --embedding-model "$GBRAIN_EMBEDDING_MODEL" \
      --embedding-dimensions "$GBRAIN_EMBEDDING_DIMS" </dev/null )
fi

# --- 5. register the venture repo as a source -------------------------------------------------------
# gbrain must never leave a file inside the venture worktree: the lane's `git add -A` would sweep it
# into a founder-facing PR. A local-only exclude (not the venture's tracked .gitignore) makes that
# safe for good — `git add -A` skips ignored files, and the lane's `git clean -fd` leaves them alone.
EXCLUDE="$REPO_DIR/.git/info/exclude"
mkdir -p "$(dirname "$EXCLUDE")"
grep -qxF '.gbrain-source' "$EXCLUDE" 2>/dev/null || printf '.gbrain-source\n.gbrain/\n' >> "$EXCLUDE"

if gbrain sources list 2>/dev/null | grep -qE "^[[:space:]]*${BRAIN_SOURCE}[[:space:]]"; then
  say "source '$BRAIN_SOURCE' already registered"
else
  say "registering the venture repo as source '$BRAIN_SOURCE'…"
  gbrain sources add "$BRAIN_SOURCE" --path "$REPO_DIR"
fi

# --- 6. first index ---------------------------------------------------------------------------------
say "indexing the venture repo (first pass — this takes a while)…"
BRAIN_SOURCE="$BRAIN_SOURCE" REPO_DIR="$REPO_DIR" BASE_BRANCH="$BASE_BRANCH" \
  "$SCRIPT_DIR/gbrain-refresh.sh" --full

# --- 7. the read-only bridge: token + env -----------------------------------------------------------
mkdir -p "$LANE_DIR"
if [ ! -f "$BRAIN_ENV" ]; then
  say "generating $BRAIN_ENV (bridge token is local to this box)…"
  umask 077
  cat > "$BRAIN_ENV" <<ENV
# Foundry venture brain (FB-050). Local to this box — never committed.
# Deliberately does NOT carry a GitHub token: the brain only ever reads what is already on disk, so
# the bridge and the refresh run without any credential the lane needs (§8, least privilege).
FOUNDRY_BRAIN_SOURCE=$BRAIN_SOURCE
FOUNDRY_BRAIN_LOCK=$LANE_DIR/state/gbrain.lock
FOUNDRY_BRAIN_TOKEN=$(openssl rand -hex 32)
FOUNDRY_BRAIN_PORT=3131
REPO_DIR=$REPO_DIR
BASE_BRANCH=$BASE_BRANCH
OLLAMA_BASE_URL=$OLLAMA_BASE_URL
PATH=$BUN_INSTALL/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ENV
fi
mkdir -p "$LANE_DIR/state"
# shellcheck disable=SC1090  # path is a runtime variable by design
BRAIN_TOKEN="$(. "$BRAIN_ENV"; printf '%s' "$FOUNDRY_BRAIN_TOKEN")"

# The composer needs the SAME token to reach the bridge. Add it to LibreChat's env if that stack is
# on this box; otherwise print it for whoever wires the composer.
if [ -f "$LIBRECHAT_DIR/.env" ]; then
  if grep -q '^FOUNDRY_BRAIN_TOKEN=' "$LIBRECHAT_DIR/.env"; then
    say "LibreChat .env already carries FOUNDRY_BRAIN_TOKEN — leaving it"
  else
    printf 'FOUNDRY_BRAIN_TOKEN=%s\n' "$BRAIN_TOKEN" >> "$LIBRECHAT_DIR/.env"
    say "added FOUNDRY_BRAIN_TOKEN to $LIBRECHAT_DIR/.env — restart the composer:"
    say "  cd $LIBRECHAT_DIR && docker compose up -d"
  fi
else
  say "LibreChat not found at $LIBRECHAT_DIR — set this in its .env when you wire the composer:"
  say "  FOUNDRY_BRAIN_TOKEN=$BRAIN_TOKEN"
fi

# --- 8. systemd: the bridge + the refresh timer ------------------------------------------------------
if [ -d /etc/systemd/system ]; then
  # The units run these from $LANE_DIR. When the script IS being run from there (the documented
  # `/opt/foundry/lane/install-gbrain.sh`), copying would be `install`-ing a file onto itself, which
  # errors out and — under set -e — would abort the install just before enabling the services.
  if [ "$SCRIPT_DIR" != "$LANE_DIR" ]; then
    install -m 0755 "$SCRIPT_DIR/brain-lib.mjs" "$SCRIPT_DIR/brain-query.mjs" "$SCRIPT_DIR/brain-bridge.mjs" \
        "$SCRIPT_DIR/gbrain-refresh.sh" "$LANE_DIR/"
  fi
  install -m 0644 "$SCRIPT_DIR/foundry-brain-bridge.service" "$SCRIPT_DIR/foundry-brain-sync.service" \
      "$SCRIPT_DIR/foundry-brain-sync.timer" /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable --now foundry-brain-bridge.service
  systemctl enable --now foundry-brain-sync.timer
  say "bridge + refresh timer enabled"
  # The LANE reads brain.env too (which source to query, the shared lock). A box provisioned before
  # FB-050 has a lane unit without that line, and the failure would be quiet: the lane would query
  # the wrong source instead of not working. Say so rather than silently patch another unit.
  if [ -f /etc/systemd/system/foundry-lane.service ] &&
     ! grep -q 'brain.env' /etc/systemd/system/foundry-lane.service; then
    say "ACTION NEEDED: this box's foundry-lane.service predates FB-050. Re-copy it from"
    say "  deploy/lane/foundry-lane.service, then: systemctl daemon-reload"
    say "  Until then the lane's RESEARCH will not be scoped to this venture's brain source."
  fi
else
  say "no systemd here — skipping the bridge/timer units"
fi

# --- 9. verify --------------------------------------------------------------------------------------
say "verifying…"
if OUT=$(FOUNDRY_BRAIN_SOURCE="$BRAIN_SOURCE" FOUNDRY_BRAIN_LOCK="$LANE_DIR/state/gbrain.lock" \
         node "$SCRIPT_DIR/brain-query.mjs" --question "what is this venture and who is it for" --limit 5 2>&1); then
  say "  brain answers queries OK:"
  printf '%s\n' "$OUT" | head -4 | sed 's/^/    /'
else
  say "  WARN: the brain did not answer a test query yet:"
  printf '%s\n' "$OUT" | head -4 | sed 's/^/    /'
  say "  If the repo has no context/ yet this is expected — deposit something via the composer first."
fi
say "done. The lane's RESEARCH step will now plan from the brain; the composer can search it too."
