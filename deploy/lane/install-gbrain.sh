#!/usr/bin/env bash
# Install the venture BRAIN on a venture box (FB-050) — gbrain indexing the venture repo, so the
# lane's RESEARCH step and the founder's composer both answer from everything the venture knows
# (D8: `context/`, `library/`, `docs/tickets/`, code) instead of re-reading raw files.
#
# Idempotent; run once per box as root, re-run to repair/repin. Design: docs/venture-brain.md.
#
# WHAT IT SETS UP
#   1. gbrain (pinned rev), with a LOCAL PGLite brain — no external database. `gbrain init` stores it
#      at ~/.gbrain/brain.pglite (root's home, since the units run as root); that is the path to back
#      up and to size disk for. BRAIN_DIR below is only the working directory init is run from.
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
: "${BRAIN_DIR:=/opt/foundry/brain}"     # where `gbrain init` is RUN — never inside the venture
                                         # worktree. The database itself lands in ~/.gbrain/.
: "${BRAIN_SOURCE:=venture}"             # gbrain source id for this venture's repo
: "${BRAIN_ENV:=$LANE_DIR/brain.env}"
: "${LIBRECHAT_DIR:=/opt/foundry/librechat}"
: "${BRAIN_PORT:=3131}"                  # one source of truth: brain.env + LibreChat's .env
: "${GBRAIN_EMBEDDING_MODEL:=ollama:nomic-embed-text}"
: "${GBRAIN_EMBEDDING_DIMS:=768}"
: "${OLLAMA_MEMORY_MAX:=900M}"           # cap the embedder; see the RAM note in step 3
: "${OLLAMA_KEEP_ALIVE:=30s}"            # unload the model between syncs rather than squatting on RAM
: "${BRAIN_MIN_RAM_MB:=1800}"            # below this, local embeddings are a bad trade — warn loudly
: "${OLLAMA_BASE_URL:=http://localhost:11434/v1}"
# Must match FOUNDRY_BRAIN_PORT in brain.env / brain-bridge.mjs.
: "${BRIDGE_PORT:=${FOUNDRY_BRAIN_PORT:-3131}}"
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
    # A venture box also runs the founder's LIVE composer (LibreChat + Mongo + Meilisearch +
    # pgvector + rag_api) and the lane. An uncapped embedding daemon on a small box is how the
    # global OOM killer ends up choosing mongod or the api container — cgroup caps bound a unit,
    # they do not reserve memory for anyone else.
    TOTAL_RAM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo 2>/dev/null || echo 0)
    if [ "$TOTAL_RAM_MB" -lt "$BRAIN_MIN_RAM_MB" ] 2>/dev/null; then
      say "WARNING: this box has ${TOTAL_RAM_MB}MB RAM, below the ${BRAIN_MIN_RAM_MB}MB floor for local"
      say "         embeddings alongside the composer. Continuing, but consider the hosted embedder:"
      say "         GBRAIN_EMBEDDING_MODEL=openai:text-embedding-3-large GBRAIN_EMBEDDING_DIMS=1536"
    fi
    if ! command -v ollama >/dev/null 2>&1; then
      say "installing Ollama (local embeddings — venture content stays on this box)…"
      curl -fsSL https://ollama.com/install.sh | sh
    fi
    if [ -d /etc/systemd/system ]; then
      mkdir -p /etc/systemd/system/ollama.service.d
      cat > /etc/systemd/system/ollama.service.d/foundry.conf <<OLLAMA
# Installed by FB-050's install-gbrain.sh. Bounds the embedder so it cannot starve the founder's
# live composer, and unloads the model between syncs instead of holding RAM idle.
[Service]
MemoryHigh=$OLLAMA_MEMORY_MAX
MemoryMax=$OLLAMA_MEMORY_MAX
Environment=OLLAMA_KEEP_ALIVE=$OLLAMA_KEEP_ALIVE
OLLAMA
      systemctl daemon-reload
    fi
    systemctl enable --now ollama 2>/dev/null || true
    systemctl restart ollama 2>/dev/null || true
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

# --- 6. box state FIRST: env, token, units ----------------------------------------------------------
# Deliberately ordered before the first index. Indexing is the one step that can plausibly fail on a
# small box (OOM under the local embedder, a cold Ollama, a lock timeout), and under `set -e` a
# failure there used to abort the installer with NO brain.env, NO token and NO units — leaving a box
# that has gbrain and a registered source but nothing the lane or the bridge keys off, and a re-run
# that just fails the same way. State first means the box is always usable and the timer can catch up.
mkdir -p "$LANE_DIR/state"
if [ ! -f "$BRAIN_ENV" ]; then
  say "generating $BRAIN_ENV (bridge token is local to this box)…"
  umask 077
  cat > "$BRAIN_ENV" <<ENV
# Foundry venture brain (FB-050). Local to this box — never committed.
# Deliberately does NOT carry a GitHub token: the brain only ever reads what is already on disk, so
# the bridge and the refresh run without any credential the lane needs (§8, least privilege).
# Nor REPO_DIR/BASE_BRANCH/PATH: foundry-lane.service loads this file too, and a later
# EnvironmentFile wins in systemd — re-declaring them here would silently override the operator's
# lane.env. The sync unit sets what it needs itself.
FOUNDRY_BRAIN_SOURCE=$BRAIN_SOURCE
FOUNDRY_BRAIN_LOCK=$LANE_DIR/state/gbrain.lock
FOUNDRY_BRAIN_TOKEN=$(openssl rand -hex 32)
FOUNDRY_BRAIN_PORT=$BRAIN_PORT
OLLAMA_BASE_URL=$OLLAMA_BASE_URL
ENV
fi
# What the SYNC unit needs and nobody else should inherit. Kept out of brain.env precisely because
# the lane unit loads that one: REPO_DIR here would override the operator's lane.env.
if [ ! -f "$LANE_DIR/brain-sync.env" ]; then
  umask 077
  cat > "$LANE_DIR/brain-sync.env" <<ENV
# Foundry venture brain — settings for the refresh unit only (FB-050). No credentials: the refresh
# only ever reads what is already on disk.
REPO_DIR=$REPO_DIR
BASE_BRANCH=$BASE_BRANCH
LANE_DIR=$LANE_DIR
PATH=$BUN_INSTALL/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ENV
fi
# shellcheck disable=SC1090  # path is a runtime variable by design
BRAIN_TOKEN="$(. "$BRAIN_ENV"; printf '%s' "$FOUNDRY_BRAIN_TOKEN")"

# The composer needs the SAME token to reach the bridge. Add it to LibreChat's env if that stack is
# on this box; otherwise print it for whoever wires the composer.
if [ -f "$LIBRECHAT_DIR/.env" ]; then
  # Match a NON-EMPTY value. `.env.example` ships the key blank (`FOUNDRY_BRAIN_TOKEN=`) so the
  # composer can start unauthorized, and the documented bring-up is `cp .env.example .env` — so a
  # bare `grep '^FOUNDRY_BRAIN_TOKEN='` matches that placeholder, skips writing the real token, and
  # prints success while the founder gets "not yet authorized" on every question, forever.
  if grep -qE '^FOUNDRY_BRAIN_TOKEN=[^[:space:]#]' "$LIBRECHAT_DIR/.env"; then
    say "LibreChat .env already carries a FOUNDRY_BRAIN_TOKEN — leaving it"
  elif grep -q '^FOUNDRY_BRAIN_TOKEN=' "$LIBRECHAT_DIR/.env"; then
    # The placeholder is there but empty — fill it in place rather than appending a duplicate key.
    sed -i "s|^FOUNDRY_BRAIN_TOKEN=.*|FOUNDRY_BRAIN_TOKEN=$BRAIN_TOKEN|" "$LIBRECHAT_DIR/.env"
    grep -q '^FOUNDRY_BRAIN_URL=' "$LIBRECHAT_DIR/.env" \
      || printf 'FOUNDRY_BRAIN_URL=http://host.docker.internal:%s\n' "$BRAIN_PORT" >> "$LIBRECHAT_DIR/.env"
    chmod 600 "$LIBRECHAT_DIR/.env"
    say "filled in FOUNDRY_BRAIN_TOKEN in $LIBRECHAT_DIR/.env — recreate the composer to pick it up:"
    say "  cd $LIBRECHAT_DIR && docker compose up -d --force-recreate api"
  else
    # Append on a line of its own even if the file doesn't end in a newline — otherwise the token
    # would be glued onto whatever the last setting is and silently corrupt BOTH.
    [ -s "$LIBRECHAT_DIR/.env" ] && [ -n "$(tail -c1 "$LIBRECHAT_DIR/.env")" ] && printf '\n' >> "$LIBRECHAT_DIR/.env"
    printf 'FOUNDRY_BRAIN_TOKEN=%s\n' "$BRAIN_TOKEN" >> "$LIBRECHAT_DIR/.env"
    # The port lives in one place (BRAIN_PORT) and is written to both sides here; otherwise changing
    # it on a box breaks the composer silently while the lane keeps working.
    grep -q '^FOUNDRY_BRAIN_URL=' "$LIBRECHAT_DIR/.env" \
      || printf 'FOUNDRY_BRAIN_URL=http://host.docker.internal:%s\n' "$BRAIN_PORT" >> "$LIBRECHAT_DIR/.env"
    # That file also holds ANTHROPIC_API_KEY, GOOGLE_CLIENT_SECRET and MEILI_MASTER_KEY, and is
    # created 0644 by deploy/librechat/install.sh. Don't leave the box's secrets world-readable.
    chmod 600 "$LIBRECHAT_DIR/.env"
    # RECREATE, not restart: env_file is only read when the container is created, so a plain
    # `up -d` leaves the api container running with an empty token and the composer reports the
    # brain as "not yet authorized". (deploy/librechat/README.md records this gotcha.)
    say "added FOUNDRY_BRAIN_TOKEN to $LIBRECHAT_DIR/.env — recreate the composer to pick it up:"
    say "  cd $LIBRECHAT_DIR && docker compose up -d --force-recreate api"
  fi
else
  # Never print the token: this script runs as root over ssh and its output routinely ends up in a
  # scrollback buffer or a tee'd provisioning log, which is exactly where a long-lived bearer token
  # for the venture's whole knowledge index must not accumulate (§8).
  say "LibreChat not found at $LIBRECHAT_DIR — when you wire the composer, copy FOUNDRY_BRAIN_TOKEN"
  say "  from $BRAIN_ENV into its .env (same value on both sides), then recreate the api container."
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

  # Open the bridge port to the DOCKER SUBNETS ONLY.
  #
  # A venture box runs ufw with SSH/80/443 and nothing else (provision-venture.sh), so traffic from
  # the composer's container to the host's bridge port was silently DROPPED — a connect timeout, not
  # a refusal, which is the shape of failure that looks like "the service is down" for an afternoon.
  # The bridge itself was running perfectly and had said so.
  #
  # Scoped to the private bridge ranges, never `Anywhere`: the whole venture knowledge index sits
  # behind one bearer token and this port has no business facing the internet. 172.17/16 is Docker's
  # default bridge (what `host-gateway` resolves to); 172.18/16 is where compose puts a project.
  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "^Status: active"; then
    for net in 172.17.0.0/16 172.18.0.0/16; do
      if ufw status | grep -q "$BRIDGE_PORT.*$net"; then continue; fi
      ufw allow from "$net" to any port "$BRIDGE_PORT" proto tcp comment "foundry brain bridge" >/dev/null \
        && say "ufw: allowed $net → $BRIDGE_PORT"
    done
  else
    say "no active ufw — nothing to open (check your own firewall allows the container → host on $BRIDGE_PORT)"
  fi

  systemctl enable foundry-brain-bridge.service
  # RESTART, not just `enable --now`: `--now` is a no-op on an already-active unit, so re-running the
  # installer to repair or to bump GBRAIN_PIN would leave the OLD bridge code running out of the file
  # we just replaced underneath it, while printing success.
  systemctl restart foundry-brain-bridge.service
  systemctl enable --now foundry-brain-sync.timer
  say "bridge + refresh timer enabled (bridge restarted onto the current code)"
  # The lane scripts are what actually CONSUME the brain. Installing the brain onto a box whose
  # foundry-lib.sh predates FB-050 gives you an index, a daemon and a timer burning RAM every 15
  # minutes that the lane never queries — so check rather than assume.
  if [ -f "$LANE_DIR/foundry-lib.sh" ] && ! grep -q 'brain_research' "$LANE_DIR/foundry-lib.sh"; then
    say "ACTION NEEDED: $LANE_DIR/foundry-lib.sh predates FB-050 (no brain_research), so the lane will"
    say "  NOT use the brain. Copy the current foundry-lib.sh, supervisor.sh and run-once.sh onto"
    say "  this box, or the index you just built goes unread."
  fi
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

# --- 9. first index (non-fatal by design — see the step-6 note) --------------------------------------
say "indexing the venture repo (first pass — this takes a while)…"
export BRAIN_SOURCE REPO_DIR BASE_BRANCH LANE_DIR
export FOUNDRY_BRAIN_LOCK="$LANE_DIR/state/gbrain.lock"
if ! bash "$SCRIPT_DIR/gbrain-refresh.sh" --full; then
  say "WARN: the first index did not complete. The box is otherwise set up and the 15-minute timer"
  say "      will keep trying — check: journalctl -u foundry-brain-sync -n 50"
fi

# --- 10. verify -------------------------------------------------------------------------------------
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
