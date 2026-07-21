#!/usr/bin/env bash
#
# provision-venture.sh — stand up (or reconcile) a venture's VPS from its manifest (FB-011, D1:
# one VPS per venture). Idempotent enough to re-run; `--dry-run` renders the plan + cloud-init
# without touching Hetzner, so it's reviewable without credentials.
#
# Scriptable steps run here. Steps that need an interactive login or a human decision are printed
# as [MANUAL] at the end — nothing external executes silently (CLAUDE.md gates).
#
# Usage:
#   HCLOUD_TOKEN=... scripts/provision-venture.sh ventures/the-reset.yaml
#   scripts/provision-venture.sh ventures/arca.yaml --dry-run
#
# Env (with defaults):
#   HCLOUD_TOKEN        Hetzner Cloud API token (required unless --dry-run)
#   SERVER_TYPE=cx22    CX-class per current workshop sizing (2 vCPU / 4GB); document changes
#   LOCATION=nbg1       Hetzner location
#   IMAGE=ubuntu-24.04  base image
#   JOHN_GITHUB_LOGIN=wealthcx01   Bruntsfield admin GitHub login (SSH keys pulled from GitHub)
#   GITHUB_ORG=wealthcx01          org the venture repos live under

set -euo pipefail

SERVER_TYPE="${SERVER_TYPE:-cx22}"
LOCATION="${LOCATION:-nbg1}"
IMAGE="${IMAGE:-ubuntu-24.04}"
JOHN_GITHUB_LOGIN="${JOHN_GITHUB_LOGIN:-wealthcx01}"
GITHUB_ORG="${GITHUB_ORG:-wealthcx01}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLOUD_INIT_TMPL="${SCRIPT_DIR}/cloud-init.yaml.tmpl"

log()  { printf '\033[0;32m[provision]\033[0m %s\n' "$*"; }
warn() { printf '\033[0;33m[provision]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[0;31m[provision] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

DRY_RUN=0
MANIFEST=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -*) die "unknown flag: $arg" ;;
    *) MANIFEST="$arg" ;;
  esac
done

[ -n "$MANIFEST" ] || die "usage: provision-venture.sh <manifest.yaml> [--dry-run]"
[ -f "$MANIFEST" ] || die "manifest not found: $MANIFEST"

require() { command -v "$1" >/dev/null 2>&1 || die "missing prerequisite: $1 (see docs/provisioning.md)"; }
require yq
require curl
require ssh
if [ "$DRY_RUN" -eq 0 ]; then
  require hcloud
  [ -n "${HCLOUD_TOKEN:-}" ] || die "HCLOUD_TOKEN is required (or pass --dry-run)"
fi

# --- read the manifest -----------------------------------------------------------------------
VENTURE_ID="$(yq -r '.id' "$MANIFEST")"
VENTURE_NAME="$(yq -r '.name // .id' "$MANIFEST")"
FOUNDER_LOGIN="$(yq -r '.founder.github_login // ""' "$MANIFEST")"
FOUNDER_EMAIL="$(yq -r '.founder.workspace_email // ""' "$MANIFEST")"
mapfile -t REPOS < <(yq -r '.repos[]?' "$MANIFEST")

# --- validate every value before it reaches a shell, an ssh command, awk, or the YAML ---------
# Untrusted-in-principle (a typo'd or malicious manifest must never inject a root command on the
# box, nor corrupt the rendered cloud-init). Strict allowlists neutralize injection at the source.
valid_slug() { [[ "$1" =~ ^[a-z0-9][a-z0-9-]*$ ]]; }        # venture id → hostname → YAML
valid_name() { [[ "$1" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]; } # repo / org / GitHub login

if [ -z "$VENTURE_ID" ] || [ "$VENTURE_ID" = "null" ]; then die "manifest has no .id"; fi
valid_slug "$VENTURE_ID" || die "venture id must be a slug [a-z0-9-]: got '${VENTURE_ID}'"
valid_name "$GITHUB_ORG" || die "GITHUB_ORG is not a valid name: '${GITHUB_ORG}'"
valid_name "$JOHN_GITHUB_LOGIN" || die "JOHN_GITHUB_LOGIN is not a valid GitHub login: '${JOHN_GITHUB_LOGIN}'"
[ -z "$FOUNDER_LOGIN" ] || valid_name "$FOUNDER_LOGIN" || die "founder.github_login is not a valid GitHub login: '${FOUNDER_LOGIN}'"
for repo in "${REPOS[@]}"; do
  valid_name "$repo" || die "repo name is not a valid slug (injection guard): '${repo}'"
done

# D3: reject a personal mailbox as the founder identity (case-insensitive; Google personal domains).
case "${FOUNDER_EMAIL,,}" in
  *@gmail.com | *@googlemail.com) die "founder.workspace_email is a personal Google mailbox — must be a venture-domain Workspace account (D3)" ;;
esac

HOSTNAME="venture-${VENTURE_ID}"
log "venture: ${VENTURE_NAME} (${VENTURE_ID})  host: ${HOSTNAME}"
log "founder: ${FOUNDER_LOGIN:-<none>} <${FOUNDER_EMAIL:-<none>}>  repos: ${REPOS[*]:-<none>}"

# --- collect SSH public keys (founder + John) from their GitHub accounts ----------------------
fetch_keys() {
  local login="$1"
  [ -n "$login" ] || return 0
  curl -fsSL "https://github.com/${login}.keys" 2>/dev/null || warn "no public SSH keys for GitHub user ${login}"
}
# Accept classic and FIDO/security keys (sk-ssh-*, sk-ecdsa-*), else an account with only a
# hardware key would resolve zero keys and lock provisioning out.
AUTHORIZED_KEYS="$( { fetch_keys "$JOHN_GITHUB_LOGIN"; fetch_keys "$FOUNDER_LOGIN"; } | grep -E '^(sk-)?(ssh|ecdsa)-' || true )"
[ -n "$AUTHORIZED_KEYS" ] || die "no SSH public keys resolved for ${JOHN_GITHUB_LOGIN} / ${FOUNDER_LOGIN} — cannot provision key-only SSH"
KEY_COUNT="$(printf '%s\n' "$AUTHORIZED_KEYS" | grep -c . || true)"
log "resolved ${KEY_COUNT} SSH key(s) for founder + John"

# --- render cloud-init (hardening + base tooling; key-only SSH) -------------------------------
[ -f "$CLOUD_INIT_TMPL" ] || die "missing template: $CLOUD_INIT_TMPL"
render_cloud_init() {
  local keys_block
  keys_block="$(printf '%s\n' "$AUTHORIZED_KEYS" | sed 's/^/      - /')"
  # Export for envsubst-free substitution via awk to avoid quoting pitfalls.
  awk -v host="$HOSTNAME" -v vid="$VENTURE_ID" -v keys="$keys_block" '
    { gsub(/__HOSTNAME__/, host); gsub(/__VENTURE_ID__/, vid);
      if ($0 ~ /__AUTHORIZED_KEYS__/) { print keys } else { print } }' "$CLOUD_INIT_TMPL"
}
CLOUD_INIT="$(render_cloud_init)"

if [ "$DRY_RUN" -eq 1 ]; then
  log "--dry-run: rendered cloud-init below; no server created."
  printf '%s\n' "$CLOUD_INIT"
  log "would run: hcloud server create --name ${HOSTNAME} --type ${SERVER_TYPE} --image ${IMAGE} --location ${LOCATION} --user-data-from-file -"
  exit 0
fi

# --- create (or reconcile) the Hetzner box ----------------------------------------------------
export HCLOUD_TOKEN
if hcloud server describe "$HOSTNAME" >/dev/null 2>&1; then
  log "server ${HOSTNAME} already exists — skipping create (idempotent). NOTE: cloud-init hardening"
  log "runs first-boot only; a re-run reconciles repos, not the OS baseline. To re-apply hardening, rebuild."
else
  log "creating server ${HOSTNAME} (${SERVER_TYPE} @ ${LOCATION}, ${IMAGE})..."
  printf '%s' "$CLOUD_INIT" | hcloud server create \
    --name "$HOSTNAME" --type "$SERVER_TYPE" --image "$IMAGE" --location "$LOCATION" \
    --user-data-from-file - >/dev/null
fi
SERVER_IP="$(hcloud server ip "$HOSTNAME")"
log "server IP: ${SERVER_IP}"

# --- wait for SSH ----------------------------------------------------------------------------
log "waiting for SSH on ${SERVER_IP}..."
ssh_ready=0
for _ in $(seq 1 30); do
  if ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 "root@${SERVER_IP}" true 2>/dev/null; then
    ssh_ready=1
    log "SSH up."
    break
  fi
  sleep 10
done
[ "$ssh_ready" -eq 1 ] || die "SSH never came up on ${SERVER_IP} after ~5min — check the box / cloud-init status"

# --- clone the venture repos (scriptable; auth via a checked-out gh on the box) ---------------
# ${repo}/${GITHUB_ORG} are intentionally expanded client-side into the remote command.
# shellcheck disable=SC2029
for repo in "${REPOS[@]}"; do
  ssh -o StrictHostKeyChecking=accept-new "root@${SERVER_IP}" \
    "test -d /srv/${repo} || git clone https://github.com/${GITHUB_ORG}/${repo}.git /srv/${repo}" \
    || warn "clone of ${GITHUB_ORG}/${repo} failed (repo may not exist yet — FB-011 provisions repos later)"
done

log "scriptable provisioning complete for ${HOSTNAME} (${SERVER_IP})."

cat <<MANUAL

============================================================================
[MANUAL] Steps that need an interactive login or a human decision — run these
by hand on the box (ssh root@${SERVER_IP}); they are NOT automated by design:

  1. Claude Code login:        claude   (then authenticate)
  2. gstack + gbrain init:     follow docs/provisioning.md §Tooling
  3. GitHub org auth:          gh auth login   (org: ${GITHUB_ORG})
  4. tmux lane(s):             one window per lane in the manifest (see runbook)
  5. Founder Workspace identity: create ${FOUNDER_EMAIL:-<founder>@venture-domain}
     in Google Workspace (Bruntsfield-assigned) — see docs/provisioning.md §Identity
  6. Claude subscription:      confirm how this lane is powered (shared Max vs
     per-venture) + record the per-venture cost line — a decision, not a default.
============================================================================
MANUAL
