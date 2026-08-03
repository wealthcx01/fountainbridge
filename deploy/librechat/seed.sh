#!/usr/bin/env bash
# Seed a venture box's agents (FB-088).
#
# seed-agent.js is fed to mongosh, whose `process.env` is the mongo container's — it cannot see this
# box's LibreChat .env. So the venture's identity is read here and injected as mongosh globals.
#
# Running the seeder directly still works and is not wrong; it just produces a generically-named
# composer, because nothing told it which venture it serves. Use this instead.
set -euo pipefail
LC_DIR="${LC_DIR:-/opt/foundry/librechat}"
MONGO="${MONGO:-librechat-mongodb}"
cd "$LC_DIR"

[ -f .env ] || { echo "seed: no .env in $LC_DIR" >&2; exit 1; }

# Read WITHOUT sourcing: values are unquoted and contain spaces ("a graded trading-card ..."), which
# `.` would try to execute. Take everything after the first `=`, verbatim.
val() { sed -n "s/^$1=//p" .env | head -1 | sed 's/[[:space:]]*$//'; }
# Single-quote for the --eval string; a literal quote in a venture name would otherwise break it.
q() { printf "'%s'" "$(printf '%s' "$1" | sed "s/'/\\\\'/g")"; }

REPO=$(val VENTURE_REPO); NAME=$(val VENTURE_NAME)
DESC=$(val VENTURE_DESCRIPTION); PREFIX=$(val VENTURE_TICKET_PREFIX)
[ -n "$REPO" ] || { echo "seed: VENTURE_REPO is not set in $LC_DIR/.env — refusing to seed a venture that cannot name itself" >&2; exit 1; }

EVAL="VENTURE_REPO=$(q "$REPO");"
[ -n "$NAME" ]   && EVAL="$EVAL VENTURE_NAME=$(q "$NAME");"
[ -n "$DESC" ]   && EVAL="$EVAL VENTURE_DESCRIPTION=$(q "$DESC");"
[ -n "$PREFIX" ] && EVAL="$EVAL VENTURE_TICKET_PREFIX=$(q "$PREFIX");"

EVAL="$EVAL void 0;"
echo "seed: ${NAME:-$REPO} (tickets $(printf '%s' "${PREFIX:-${REPO##*/}}" | tr '[:lower:]-' '[:upper:]_')-NNN)"
docker exec -i "$MONGO" mongosh LibreChat --quiet --eval "$EVAL" --file /dev/stdin < seed-agent.js
echo "seed: done — now: docker compose restart api"
