#!/usr/bin/env bash
# Move a venture box's secrets into one file (FB-176).
#
# The rotation this came from found one live token in five places and changed one of them. This puts
# the secrets in `/etc/foundry/credentials` (root, 0600) and leaves a pointer where each one was, so
# the next person to open `lane.env` looking for a token is told where it went instead of finding a
# stale copy that still works.
#
# Safe to run twice: a key already in the credentials file is not overwritten from a stale source.
set -euo pipefail

DEFAULT_HOME=/etc/foundry/credentials
HOME_FILE="${FOUNDRY_CREDENTIALS:-$DEFAULT_HOME}"
LANE_ENV="${LANE_ENV:-/opt/foundry/lane/lane.env}"
CHAT_ENV="${CHAT_ENV:-/opt/foundry/librechat/.env}"

# The keys that are secrets. Everything else in those files stays exactly where it is — this moves
# credentials, it does not reorganise a box's configuration.
SECRET_KEYS="TICKET_GITHUB_TOKEN STATUS_GITHUB_TOKEN ANTHROPIC_API_KEY CLAUDE_CODE_OAUTH_TOKEN COMPOSER_API_KEY FOUNDRY_OFFICE_SECRET FOUNDRY_APPROVAL_SECRET"

say() { printf '[credentials] %s\n' "$*"; }
die() { printf '[credentials] %s\n' "$*" >&2; exit 1; }

# Root is required for the real thing, because the point is a file owned by root at mode 0600 in
# /etc. It is NOT required when FOUNDRY_CREDENTIALS points somewhere else — that is a test or a dry
# run against a copy of a box, and a script nobody can exercise without root is a script nobody
# exercises. The ownership below is still attempted either way and simply does not apply when it
# cannot.
if [ "$HOME_FILE" = "$DEFAULT_HOME" ] && [ "$(id -u)" -ne 0 ]; then
  die "run me as root — this writes $HOME_FILE with mode 0600"
fi

mkdir -p "$(dirname "$HOME_FILE")"
touch "$HOME_FILE"
chown root:root "$HOME_FILE" 2>/dev/null || true
chmod 600 "$HOME_FILE"

# Read a KEY's value out of an env file. Last assignment wins, matching systemd and docker-compose.
# Never echoed — the value only ever travels between files.
value_of() {
  local key="$1" file="$2"
  [ -f "$file" ] || return 1
  sed -n "s/^[[:space:]]*${key}=//p" "$file" | tail -1 | sed 's/^"//; s/"$//; s/^'"'"'//; s/'"'"'$//'
}

has_key() { grep -q "^${1}=" "$HOME_FILE" 2>/dev/null; }

moved=0
kept=0
for key in $SECRET_KEYS; do
  if has_key "$key"; then
    kept=$((kept + 1))
    continue
  fi
  for src in "$LANE_ENV" "$CHAT_ENV"; do
    v="$(value_of "$key" "$src" || true)"
    if [ -n "${v:-}" ]; then
      printf '%s=%s\n' "$key" "$v" >> "$HOME_FILE"
      say "$key → $HOME_FILE (found in $(basename "$src"))"
      moved=$((moved + 1))
      break
    fi
  done
done

# A file with nothing in it is worse than no file: systemd would load it happily and the lane would
# fail later with "could not read Username for 'https://github.com'", which says nothing about why.
if [ ! -s "$HOME_FILE" ]; then
  rm -f "$HOME_FILE"
  die "found no secrets in $LANE_ENV or $CHAT_ENV — nothing written, and $HOME_FILE removed.
      Put them there by hand, or check those paths are right."
fi

# Now blank the copies, leaving a pointer rather than a hole. A commented-out key is how somebody
# reading this file later learns where the value lives; a deleted line teaches them nothing.
#
# The backup is taken ONCE per file, before the first key is moved out of it, and then has its own
# secrets blanked. A backup that still holds the token would be this script creating a sixth copy of
# the credential while claiming to reduce them to one — in a file the scanner would then, correctly,
# flag. What an operator needs from a backup is the rest of the configuration, verbatim; the value is
# the one thing they must not need from it, because it is safely in the home file by this point.
for src in "$LANE_ENV" "$CHAT_ENV"; do
  [ -f "$src" ] || continue
  touched=0
  for key in $SECRET_KEYS; do
    has_key "$key" || continue
    grep -q "^[[:space:]]*${key}=" "$src" || continue
    if [ "$touched" -eq 0 ]; then
      cp -a "$src" "$src.pre-fb176"
      chmod 600 "$src.pre-fb176"
      touched=1
    fi
    sed -i "s|^[[:space:]]*${key}=.*|# ${key} now lives in ${HOME_FILE} (FB-176 — one home, mode 0600)|" "$src"
    sed -i "s|^[[:space:]]*${key}=.*|# ${key} was here before FB-176; its value is in ${HOME_FILE}|" "$src.pre-fb176"
    say "$key removed from $(basename "$src")"
  done
  [ "$touched" -eq 1 ] && say "$(basename "$src") backed up to $(basename "$src").pre-fb176, with its secrets blanked"
done

say "$moved moved, $kept already here."
say "next: systemctl restart foundry-lane.timer, and recreate the composer container"
say "      (.env is read on recreate, not restart — deploy/librechat/README.md)."
say "then: deploy/foundry/secret-scan.mjs"
