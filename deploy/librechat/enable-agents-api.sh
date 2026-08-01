#!/usr/bin/env bash
# Enable the LibreChat Agents API on a venture box, and mint the key the studio uses (FB-065).
#
# WHY THIS EXISTS
# The composer used to be a second product at a second address. FB-065 moves the conversation into
# the studio and keeps LibreChat as the engine behind its documented, versioned Agents API
# (`/api/agents/v1/chat/completions`) — not the internal browser route, which needed a hand-minted
# JWT and a browser User-Agent to get past a bot check. Building on someone's private internals is
# how you get a product that breaks on their next release.
#
# Three things have to be true before that API answers, and none of them are on by default:
#   1. `interface.remoteAgents.use: true` in librechat.yaml (this repo's copy already sets it),
#   2. an API key, minted for a real user through `/api/api-keys`,
#   3. an ACL grant per agent — an agent is invisible to the Agents API until someone with the
#      agent has been given REMOTE_AGENT access to it. An empty `/v1/models` is what a missing
#      grant looks like, which reads exactly like "the feature is off".
#
# Run it on the box, as root:
#     ./enable-agents-api.sh                    # composer agent, the box's first user
#     ./enable-agents-api.sh agent_foundry_research founder@example.com
#
# It prints the key ONCE. Put it on the studio as COMPOSER_API_KEY_<VENTURE_ID>; it is never
# written to this repo (CLAUDE.md #8) and LibreChat stores only a hash of it.
set -euo pipefail

AGENT_ID="${1:-agent_foundry_composer}"
USER_EMAIL="${2:-}"
KEY_NAME="${KEY_NAME:-foundry-studio}"
LC_DIR="${LC_DIR:-/opt/foundry/librechat}"
API="${API:-librechat-api}"
MONGO="${MONGO:-librechat-mongodb}"
APIURL="${APIURL:-http://127.0.0.1:3080}"

die() { echo "enable-agents-api: $*" >&2; exit 1; }

command -v docker >/dev/null || die "docker not found — run this on the venture box"
command -v curl >/dev/null || die "curl not found — needed to call the API from the host"
docker ps --format '{{.Names}}' | grep -qx "$API" || die "$API is not running"

# The Agents API only exists once the config turns it on. Checking the FILE (not the API) keeps the
# error honest: a 401 from /v1/models means "no key", but an empty model list means "no grant", and
# neither one tells you the feature is off.
grep -q 'remoteAgents:' "$LC_DIR/librechat.yaml" \
  || die "librechat.yaml has no remoteAgents block — deploy this repo's deploy/librechat/librechat.yaml first, then restart $API"

# --- the user the key belongs to -----------------------------------------------------------------
# Requests made with this key act as this user, so it must be a real founder account on this box.
# One key per venture box, and a box holds exactly one venture (D1), so the key can never reach
# another venture's data.
if [ -z "$USER_EMAIL" ]; then
  USER_EMAIL=$(docker exec "$MONGO" mongosh LibreChat --quiet \
    --eval 'const u = db.users.findOne({}, {email:1}); print(u ? u.email : "")' 2>/dev/null | tr -d '\r')
  [ -n "$USER_EMAIL" ] || die "no users on this box yet — sign in to LibreChat once, then re-run"
  echo "enable-agents-api: no email given, using the box's first user: $USER_EMAIL"
fi

USER_ID=$(docker exec "$MONGO" mongosh LibreChat --quiet \
  --eval "const u = db.users.findOne({email: '$USER_EMAIL'}, {_id:1}); print(u ? u._id.toString() : '')" 2>/dev/null | tr -d '\r')
[ -n "$USER_ID" ] || die "no user with email $USER_EMAIL on this box"

AGENT_OBJID=$(docker exec "$MONGO" mongosh LibreChat --quiet \
  --eval "const a = db.agents.findOne({id: '$AGENT_ID'}, {_id:1}); print(a ? a._id.toString() : '')" 2>/dev/null | tr -d '\r')
[ -n "$AGENT_OBJID" ] || die "no agent with id $AGENT_ID — run seed-agent.js first"

# --- 3. the ACL grant ----------------------------------------------------------------------------
# LibreChat's own `backfillRemoteAgentPermissions` writes this row, but it cannot be driven from
# outside the running server (its `~/…` module aliases are registered by the app entrypoint). So the
# row is written directly, in the shape that helper produces — the role document supplies `permBits`
# and `roleId`, so nothing here is a guess about their permission model.
#
# It grants VIEWER, not the OWNER the upstream backfill uses: listing and chatting need VIEW, and a
# key that could also edit or delete the founder's agent is more than this needs.
# Idempotent — $setOnInsert on an upsert, so re-running never widens an existing grant.
echo "enable-agents-api: granting remote access to $AGENT_ID for $USER_EMAIL"
docker exec "$MONGO" mongosh LibreChat --quiet --eval "
  const role = db.accessroles.findOne({ accessRoleId: 'remoteAgent_viewer' });
  if (!role) { print('NO_ROLE'); quit(1); }
  db.aclentries.updateOne(
    {
      principalType: 'user',
      principalId: ObjectId('$USER_ID'),
      resourceType: 'remoteAgent',
      resourceId: ObjectId('$AGENT_OBJID'),
    },
    { \$setOnInsert: {
        principalType: 'user',
        principalId: ObjectId('$USER_ID'),
        principalModel: 'User',
        resourceType: 'remoteAgent',
        resourceId: ObjectId('$AGENT_OBJID'),
        permBits: role.permBits,
        roleId: role._id,
        grantedBy: ObjectId('$USER_ID'),
        grantedAt: new Date(),
      } },
    { upsert: true },
  );
  print('OK');
" 2>/dev/null | grep -q OK || die "granting remote access failed"

GRANTED=$(docker exec "$MONGO" mongosh LibreChat --quiet \
  --eval "print(db.aclentries.countDocuments({resourceType: 'remoteAgent', resourceId: ObjectId('$AGENT_OBJID')}))" 2>/dev/null | tr -d '\r')
[ "${GRANTED:-0}" -ge 1 ] || die "the grant did not land — /v1/models would come back empty"

# --- 2. the API key ------------------------------------------------------------------------------
# Minted through the app's own route so it is hashed and revocable the same way a UI-created key is.
# The short-lived JWT below is the documented way to authenticate as a user server-side; it never
# leaves the box.
# Read the one value needed rather than sourcing the file: a box .env holds unquoted values with
# spaces (`APP_TITLE=Bruntsfield Foundry`), and `. .env` runs those as commands.
JWT_SECRET=$(sed -n 's/^JWT_SECRET=//p' "$LC_DIR/.env" | head -1 | tr -d '"'"'"'\r')
[ -n "${JWT_SECRET:-}" ] || die "JWT_SECRET missing from $LC_DIR/.env"

JWT=$(docker exec -e JWT_SECRET="$JWT_SECRET" -e USER_ID="$USER_ID" "$API" node -e '
console.log(require("jsonwebtoken").sign({ id: process.env.USER_ID }, process.env.JWT_SECRET, { expiresIn: "5m" }));
' 2>/dev/null | tr -d '\r')
[ -n "$JWT" ] || die "could not mint a token to call /api/api-keys"

# Called from the HOST, not from inside the container: the LibreChat image ships no curl, and a
# container exec that quietly returns nothing looks identical to an API that refused the request.
RESPONSE=$(curl -sS -X POST "$APIURL/api/api-keys" \
  -H "Authorization: Bearer $JWT" -H 'Content-Type: application/json' \
  -d "{\"name\":\"$KEY_NAME\"}" 2>/dev/null)

KEY=$(printf '%s' "$RESPONSE" | sed -n 's/.*"key":"\([^"]*\)".*/\1/p')
[ -n "$KEY" ] || die "no key in the response: $RESPONSE"

# --- prove it, rather than assume it -------------------------------------------------------------
MODELS=$(curl -sS -H "Authorization: Bearer $KEY" "$APIURL/api/agents/v1/models" 2>/dev/null)
printf '%s' "$MODELS" | grep -q "\"$AGENT_ID\"" \
  || die "the key works but $AGENT_ID is not in /v1/models — the grant did not take: $MODELS"

# The venture, from the repo this box files tickets to (`wealthcx01/arca` → ARCA) — not from the
# install directory, which is `/opt/foundry` on every box and would name them all the same.
VENTURE_KEY=$(sed -n 's|^VENTURE_REPO=.*/||p' "$LC_DIR/.env" | head -1 | tr -d '"'"'"'\r' | tr '[:lower:]-' '[:upper:]_')
cat <<EOF

  The Agents API is live and answering for $AGENT_ID.

  Put this on the STUDIO (Railway → Variables), not in any repo:

      COMPOSER_API_KEY_${VENTURE_KEY:-<VENTURE_ID>}=$KEY

  It is shown once. LibreChat keeps only a hash; to replace it, revoke the key named
  "$KEY_NAME" in the UI and run this again.
EOF
