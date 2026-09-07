#!/usr/bin/env bash
#
# provision-office.sh — install the venture office on a venture's box (FB-163, FB-192, FB-198).
#
# The office is pixel-agents, run as a service on the venture's own machine and bound to loopback.
# In front of it sits `foundry-office-gate`, which is the only thing a browser ever reaches. The
# gate checks a ticket the studio signed — so which venture a person may watch is still decided by
# the studio, server-side (CLAUDE.md #6) — and drops every message from a browser except the
# office's own handshake, which is the only thing making the view read-only.
#
# The browser watches directly rather than through the studio because Railway's edge will not carry
# a WebSocket for the studio: measured at ~75ms to a cut, with the box disconnected, from two
# continents (FB-197).
#
# This exists because ARCA's office was stood up by hand, and a thing that lives only in one
# operator's shell history is not a thing the next venture has.
#
# Idempotent: re-running installs the same pinned version, rewrites the same unit, and leaves an
# already-correct Caddyfile alone.
#
# Usage:
#   scripts/provision-office.sh arca --dry-run
#   OFFICE_SECRET=$(openssl rand -base64 24 | tr -d '/+=') scripts/provision-office.sh arca
#
# Env (with defaults):
#   OFFICE_SECRET       the secret the studio signs watching tickets with (generated if unset)
#   OFFICE_PORT=4310    loopback port pixel-agents listens on
#   OFFICE_GATE_PORT=4311  loopback port the gate listens on
#   OFFICE_VERSION      the pinned pixel-agents version
#   LANE_DIR            the workspace whose Claude sessions the office draws
#   STUDIO_ORIGINS      who may put this office in a frame
#
# What it does NOT do: set the studio's own variables. Those are printed at the end as [MANUAL],
# because they are a change to a running production service and belong to a person (CLAUDE.md gates).

set -euo pipefail

OFFICE_PORT="${OFFICE_PORT:-4310}"
OFFICE_GATE_PORT="${OFFICE_GATE_PORT:-4311}"
OFFICE_VERSION="${OFFICE_VERSION:-1.4.1}"
STUDIO_ORIGINS="${STUDIO_ORIGINS:-https://*.up.railway.app https://*.bruntsfield.capital}"

log()  { printf '\033[0;32m[office]\033[0m %s\n' "$*"; }
warn() { printf '\033[0;33m[office]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[0;31m[office] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

DRY_RUN=0
VENTURE=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -*) die "unknown option: $arg" ;;
    *) VENTURE="$arg" ;;
  esac
done
[ -n "$VENTURE" ] || die "usage: scripts/provision-office.sh <venture-id> [--dry-run]"

HOST="chat.${VENTURE}.bruntsfield.capital"
LANE_DIR="${LANE_DIR:-/opt/foundry/lane/${VENTURE}}"
OFFICE_DIR="/opt/foundry/office"

# Generated rather than asked for, so nobody is tempted to reuse one between ventures. A secret that
# could reach two boxes would be a hole in the isolation the architecture rests on.
if [ -z "${OFFICE_SECRET:-}" ]; then
  OFFICE_SECRET="$(openssl rand -base64 24 | tr -d '/+=')"
  log "generated a new office secret for ${VENTURE}"
fi

remote() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '  ssh root@%s %q\n' "$HOST" "$*"
  else
    ssh -o ConnectTimeout=15 "root@${HOST}" "$*"
  fi
}

log "office for ${VENTURE} on ${HOST}: pixel-agents@${OFFICE_VERSION}, loopback ${OFFICE_PORT}"
[ "$DRY_RUN" -eq 1 ] && log "dry run — nothing will be changed"

# 1. The package, pinned. An office that upgrades itself would move the buttons the studio hides.
remote "mkdir -p ${OFFICE_DIR} && cd ${OFFICE_DIR} && \
  { [ -f package.json ] || npm init -y >/dev/null; } && \
  npm install --no-audit --no-fund pixel-agents@${OFFICE_VERSION} >/dev/null && \
  node -e \"console.log('installed', require('${OFFICE_DIR}/node_modules/pixel-agents/package.json').version)\""

# 2. The service. Loopback only — the flag is the binding, not a firewall rule somewhere else.
UNIT=$(cat <<UNIT_EOF
[Unit]
Description=Foundry venture office — pixel-agents, read-only, localhost only (FB-163)
After=network.target

[Service]
Type=simple
# The watched workspace is derived from the working directory: this is the lane whose
# Claude sessions the office draws.
WorkingDirectory=${LANE_DIR}
ExecStart=/usr/bin/node ${OFFICE_DIR}/node_modules/pixel-agents/dist/cli.js --host 127.0.0.1 --port ${OFFICE_PORT}
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
UNIT_EOF
)
if [ "$DRY_RUN" -eq 1 ]; then
  log "would write /etc/systemd/system/foundry-office.service:"
  printf '%s\n' "$UNIT" | sed 's/^/    /'
else
  printf '%s\n' "$UNIT" | ssh "root@${HOST}" 'cat > /etc/systemd/system/foundry-office.service'
  remote "systemctl daemon-reload && systemctl enable --now foundry-office && systemctl is-active foundry-office"
fi

# 3. The gate — the ticket check and the read-only filter. Its code is in the repository
#    (deploy/office/) so it is reviewed and tested like everything else, not typed into a box.
GATE_DIR="/opt/foundry/office-gate"
if [ "$DRY_RUN" -eq 1 ]; then
  log "would install the gate into ${GATE_DIR} and start foundry-office-gate on ${OFFICE_GATE_PORT}"
else
  remote "mkdir -p ${GATE_DIR} && cd ${GATE_DIR} && \
    { [ -f package.json ] || npm init -y >/dev/null; } && \
    npm install --no-audit --no-fund ws@8.18.0 >/dev/null 2>&1"
  scp -q "${SCRIPT_DIR}/../deploy/office/office-gate.mjs" "${SCRIPT_DIR}/../deploy/office/office-gate-lib.mjs" \
    "root@${HOST}:${GATE_DIR}/"
  scp -q "${SCRIPT_DIR}/../deploy/office/foundry-office-gate.service" \
    "root@${HOST}:/etc/systemd/system/"
  # The gate refuses to start without both of these, rather than serving a venture's machine to
  # whoever asks.
  printf 'OFFICE_VENTURE=%s\nOFFICE_SECRET=%s\nOFFICE_GATE_PORT=%s\nOFFICE_UPSTREAM_PORT=%s\nOFFICE_FRAME_ANCESTORS=%s\n' \
    "$VENTURE" "$OFFICE_SECRET" "$OFFICE_GATE_PORT" "$OFFICE_PORT" "$STUDIO_ORIGINS" \
    | ssh "root@${HOST}" 'cat > /opt/foundry/office-gate/gate.env && chmod 600 /opt/foundry/office-gate/gate.env' 
  remote "systemctl daemon-reload && systemctl enable --now foundry-office-gate && systemctl is-active foundry-office-gate"
fi

# 4. Caddy. A path on the hostname that already exists: no DNS record to add, no second certificate.
CADDY_BLOCK=$(cat <<CADDY_EOF
  # FB-198 — the venture office, watched by the founder's browser directly.
  #
  # \`foundry-office-gate\` is the only thing in front of pixel-agents. It checks the studio's ticket
  # and refuses to carry anything from a browser but the office's own handshake.

  # The office's socket. Its client builds this address from the page's host, so the path is \`/ws\`
  # at the root and cannot be moved without patching their bundle. Check before taking it that
  # nothing else on this hostname uses it.
  handle /ws {
    reverse_proxy 127.0.0.1:${OFFICE_GATE_PORT}
  }

  # The office's page and files.
  redir /office /office/
  handle_path /office/* {
    reverse_proxy 127.0.0.1:${OFFICE_GATE_PORT}
  }
CADDY_EOF
)
if [ "$DRY_RUN" -eq 1 ]; then
  log "would add to /etc/caddy/Caddyfile, inside the ${HOST} block, BEFORE its catch-all handle:"
  printf '%s\n' "$CADDY_BLOCK" | sed 's/^/    /'
else
  # Backed up before editing, and only added when it is not already there — Caddy's own `handle`
  # blocks are ordered, and a second /office block would shadow the first silently.
  if ssh "root@${HOST}" 'grep -q "handle_path /office/\*" /etc/caddy/Caddyfile'; then
    log "Caddy already serves /office — left alone"
  else
    warn "Caddy needs the office block added by hand: its blocks are ordered and this must sit"
    warn "BEFORE the catch-all handle for ${HOST}. Backup first:"
    warn "  ssh root@${HOST} 'cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak'"
    printf '%s\n' "$CADDY_BLOCK"
  fi
fi

# 5. Prove it, rather than assume it. Without a ticket the office is refused; the composer is
#    untouched; and nothing else on the box is reachable through the office's path.
if [ "$DRY_RUN" -eq 0 ]; then
  log "checking the gate"
  office=$(curl -s -o /dev/null -w '%{http_code}' "https://${HOST}/office/" || true)
  socket=$(curl -s -o /dev/null -w '%{http_code}' "https://${HOST}/ws" || true)
  composer=$(curl -s -o /dev/null -w '%{http_code}' "https://${HOST}/" || true)
  log "office without a ticket: ${office} (want 401) · socket: ${socket} (want 401) · composer: ${composer} (want 200)"
  if [ "$office" = "401" ] && [ "$socket" = "401" ] && [ "$composer" = "200" ]; then
    log "the gate is answering correctly"
  else
    warn "the gate is not answering as it should — do not switch the studio on"
  fi
fi

cat <<MANUAL

[MANUAL] The studio's own half. These change a running production service, so a person does them:

  railway variables --set "OFFICE_HOST_${VENTURE^^}=${HOST}" --skip-deploys
  printf '%s' '${OFFICE_SECRET}' | railway variables --set-from-stdin OFFICE_SECRET_${VENTURE^^}

Both are read together, so a venture is either fully wired or has no office at all. Until both are
set the desk shows the drawn plate, which is the honest answer. The desk checks the office socket
from the founder's own browser before it draws anything, so a box that is not answering costs a
founder the plate and nothing worse.
MANUAL
