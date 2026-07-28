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
mkdir -p "$DEST"
cp -f "$SRC/docker-compose.yml" "$SRC/librechat.yaml" "$DEST"/
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
