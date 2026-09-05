#!/usr/bin/env bash
#
# provision-office.sh — install the venture office on a venture's box (FB-163, FB-192).
#
# The office is pixel-agents, run as a service on the venture's own machine, bound to loopback, and
# reachable only through Caddy and only with the studio's shared secret. A browser never talks to
# it: the studio proxies, holds the secret, and is the only client (CLAUDE.md #6, #8).
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
#   OFFICE_SECRET       the shared secret Caddy requires (generated and printed if unset)
#   OFFICE_PORT=4310    loopback port the office listens on
#   OFFICE_VERSION      the pinned pixel-agents version
#   LANE_DIR            the workspace whose Claude sessions the office draws
#
# What it does NOT do: set the studio's own variables. Those are printed at the end as [MANUAL],
# because they are a change to a running production service and belong to a person (CLAUDE.md gates).

set -euo pipefail

OFFICE_PORT="${OFFICE_PORT:-4310}"
OFFICE_VERSION="${OFFICE_VERSION:-1.4.1}"

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

# 3. Caddy. A path on the hostname that already exists: no DNS record to add, no second certificate.
CADDY_BLOCK=$(cat <<CADDY_EOF
  # FB-163 — the venture office, for the studio and nothing else.
  handle_path /office/* {
    @studio header X-Foundry-Office "${OFFICE_SECRET}"
    handle @studio {
      reverse_proxy 127.0.0.1:${OFFICE_PORT}
    }
    handle {
      respond "This office is read through the studio." 403
    }
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

# 4. Prove it, rather than assume it. 403 without the secret, 200 with it.
if [ "$DRY_RUN" -eq 0 ]; then
  log "checking the gate"
  without=$(curl -s -o /dev/null -w '%{http_code}' "https://${HOST}/office/" || true)
  with=$(curl -s -o /dev/null -w '%{http_code}' -H "X-Foundry-Office: ${OFFICE_SECRET}" "https://${HOST}/office/" || true)
  log "without the secret: ${without} (want 403) · with it: ${with} (want 200)"
  if [ "$without" = "403" ] && [ "$with" = "200" ]; then
    log "the gate is answering correctly"
  else
    warn "the gate is not answering as it should — do not switch the studio on"
  fi
fi

cat <<MANUAL

[MANUAL] The studio's own half. These change a running production service, so a person does them:

  railway variables --set "OFFICE_HOST_${VENTURE^^}=${HOST}" --skip-deploys
  printf '%s' '${OFFICE_SECRET}' | railway variables --set-from-stdin OFFICE_SECRET_${VENTURE^^}

Both are read by the studio's HTTP route and by server.js, so a venture is either fully wired or has
no office at all. Until both are set the desk shows the drawn plate, which is the honest answer.
MANUAL
