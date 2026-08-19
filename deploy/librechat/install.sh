#!/usr/bin/env bash
#
# install.sh (FB-025) — install + start LibreChat on a venture box. Idempotent; run as root ON the
# box, from the directory holding this recipe (docker-compose.yml, librechat.yaml, .env.example).
#
#   CHAT_DOMAIN=chat.arca.bruntsfield.capital bash install.sh
#
# Installs Docker + Caddy, generates the box-local secrets, brings the stack up on 127.0.0.1:3080,
# and points Caddy (auto-TLS) at it. The human-provided values (ANTHROPIC_API_KEY, GOOGLE_CLIENT_ID/
# SECRET) are left blank in .env for you to fill in — LibreChat starts without them; Claude + Google
# sign-in activate once they're set. TLS is issued automatically once DNS points CHAT_DOMAIN here.
set -euo pipefail

: "${CHAT_DOMAIN:?set CHAT_DOMAIN, e.g. chat.arca.bruntsfield.capital}"
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST=/opt/foundry/librechat
log() { printf '\033[0;32m[librechat]\033[0m %s\n' "$*"; }

# --- 1. Docker -------------------------------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  log "installing Docker..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq docker.io docker-compose-v2
  systemctl enable --now docker
fi

# --- 2. Caddy (reverse proxy + auto-TLS) -----------------------------------------------------
if ! command -v caddy >/dev/null 2>&1; then
  log "installing Caddy..."
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy
fi

# --- 3. firewall: allow HTTP/HTTPS (SSH already open) ----------------------------------------
if command -v ufw >/dev/null 2>&1; then ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; fi

# --- 4. stage the recipe + generate box-local secrets ----------------------------------------
#
# FB-113: this used to copy docker-compose.yml and librechat.yaml and stop, while the compose file
# bind-mounted six OTHER host paths — every MCP server plus the logo. They reached ARCA by hand, so
# a genuinely fresh box came up with five healthy containers and a composer that could not file,
# deposit, search or report anything.
#
# It failed quietly because a bind mount with a missing source is not an error: docker creates an
# empty DIRECTORY at the target, and `node /app/foundry/ticket-filer.mjs` then fails on a directory
# long after install.sh has printed success.
#
# So the compose file is the single list of what the box needs, and this reads it rather than
# keeping a second hand-maintained list here to drift out of step with it.

# Bind-mount sources declared in a compose file: the `./path` of every `- ./path:/target[:ro]` entry.
# Named volumes (no leading ./) and comments (no leading -) are left out by construction.
# NOTE: deploy/librechat/__tests__/install-stages-mounts.test.mjs extracts THIS function and runs it
# against the real compose file, so the shape below is covered rather than assumed.
compose_mounts() { sed -n 's|^[[:space:]]*-[[:space:]]*\(\./[^:]*\):.*|\1|p' "$1"; }

mkdir -p "$DEST"
cp -f "$SRC/docker-compose.yml" "$SRC/librechat.yaml" "$DEST"/

# seed.sh + seed-agent.js are not mounted (they run on the host, against the mongo container), so
# they are named here. Without them a fresh box has no way to seed its own agents.
log "staging what the compose file mounts, plus the seeder..."
_missing=0
for _rel in $(compose_mounts "$SRC/docker-compose.yml") ./seed.sh ./seed-agent.js; do
  _src="$SRC/${_rel#./}"
  _dst="$DEST/${_rel#./}"
  if [ ! -f "$_src" ]; then
    # Loud, at install time, naming the file — the whole point of this section.
    printf '[librechat] MISSING %s\n' "$_src" >&2
    _missing=1
    continue
  fi
  mkdir -p "$(dirname "$_dst")"
  cp -f "$_src" "$_dst"
done
if [ "$_missing" -ne 0 ]; then
  echo "[librechat] refusing to continue: the files above are mounted or needed but not present." >&2
  echo "[librechat] docker would mount an empty directory at each target and the tool would fail at runtime." >&2
  exit 1
fi
# The exec bit does not survive every copy path, and a non-executable seed.sh fails at the worst
# moment — after the stack is up and someone is trying to seed. Assert it.
chmod +x "$DEST/seed.sh"

if [ ! -f "$DEST/.env" ]; then
  log "generating .env (secrets local to this box; human values left blank)..."
  cp "$SRC/.env.example" "$DEST/.env"
  gen() { openssl rand -hex "$1"; }
  sed -i "s|^CREDS_KEY=.*|CREDS_KEY=$(gen 32)|; s|^CREDS_IV=.*|CREDS_IV=$(gen 16)|; \
          s|^JWT_SECRET=.*|JWT_SECRET=$(gen 32)|; s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$(gen 32)|; \
          s|^MEILI_MASTER_KEY=.*|MEILI_MASTER_KEY=$(gen 32)|" "$DEST/.env"
  sed -i "s|^DOMAIN_CLIENT=.*|DOMAIN_CLIENT=https://${CHAT_DOMAIN}|; s|^DOMAIN_SERVER=.*|DOMAIN_SERVER=https://${CHAT_DOMAIN}|" "$DEST/.env"
fi

# --- 5. Caddy site: TLS + reverse proxy to LibreChat -----------------------------------------
cat > /etc/caddy/Caddyfile <<EOF
${CHAT_DOMAIN} {
  encode zstd gzip
  reverse_proxy 127.0.0.1:3080
}
EOF
systemctl reload caddy 2>/dev/null || systemctl restart caddy

# --- 6. bring the stack up -------------------------------------------------------------------
cd "$DEST"
log "starting LibreChat (docker compose up -d)..."
docker compose pull -q || true
docker compose up -d

log "done. LibreChat on 127.0.0.1:3080; Caddy fronting https://${CHAT_DOMAIN} (TLS issues once DNS resolves here)."
log "next: fill ANTHROPIC_API_KEY + GOOGLE_CLIENT_ID/SECRET in ${DEST}/.env, then: cd ${DEST} && docker compose up -d"
