#!/usr/bin/env bash
# Install gstack on a venture box so the lane runs the REAL RPIV loop (FB-041) — /plan, /review, /qa —
# instead of a raw `claude -p`. Idempotent; run once per box (re-run to repair/re-pin).
#
# gstack is a Claude Code SKILLS suite (github.com/garrytan/gstack) wired in by its ./setup. We PIN to
# a recorded commit — a third-party repo executed as root with a repo-write token in the environment
# must be reproducible, never a floating `main` (adversarial review P1). Upgrades are deliberate: bump
# GSTACK_PIN and re-run.
#
# Footprint ~1.7 GB (incl. the Playwright/Chromium browser stack /qa drives). See docs/lane-rpiv-loop.md.
set -euo pipefail

# The exact rev the studio-build lanes run (proven-good). Bump deliberately to upgrade.
: "${GSTACK_PIN:=7c9df1c568a9ea745508f679a329332b2c338063}"
: "${GSTACK_REPO:=https://github.com/garrytan/gstack}"
GSTACK_DIR="$HOME/.claude/skills/gstack"

say() { echo "[install-gstack] $*"; }

# 1. bun — gstack's runtime (unzip prerequisite is present on the provisioned box).
if ! command -v bun >/dev/null 2>&1; then
  say "installing bun…"
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"; export PATH="$BUN_INSTALL/bin:$PATH"
fi
command -v bun >/dev/null 2>&1 || { echo "bun install failed — ensure unzip is present" >&2; exit 1; }
say "bun $(bun --version)"

# 2. clone/repin gstack to the recorded commit.
if [ -d "$GSTACK_DIR/.git" ]; then
  say "gstack present — fetching + repinning to ${GSTACK_PIN:0:8}"
  git -C "$GSTACK_DIR" fetch --quiet origin
else
  # A dir without .git means a prior clone was interrupted — clear it so the clone can't fail on a
  # non-empty target (code review P2-4).
  [ -e "$GSTACK_DIR" ] && { say "removing partial gstack dir"; rm -rf "$GSTACK_DIR"; }
  say "cloning gstack…"
  mkdir -p "$(dirname "$GSTACK_DIR")"
  git clone --quiet "$GSTACK_REPO" "$GSTACK_DIR"
fi
git -C "$GSTACK_DIR" checkout --quiet "$GSTACK_PIN"
say "gstack pinned at $(git -C "$GSTACK_DIR" rev-parse --short HEAD) (VERSION $(cat "$GSTACK_DIR/VERSION" 2>/dev/null || echo '?'))"

# 3. headless-safe config BEFORE ./setup, so the skill-prefix prompt resolves from saved config (never
#    an interactive read) and headless lanes never self-upgrade / nag mid-run.
mkdir -p "$HOME/.gstack"
if [ ! -f "$HOME/.gstack/config.yaml" ]; then
  printf 'proactive: false\nauto_upgrade: false\nskill_prefix: false\n' > "$HOME/.gstack/config.yaml"
  say "seeded ~/.gstack/config.yaml (proactive off, auto_upgrade off, short skill names)"
fi

# 4. deps + the browser BEFORE ./setup. setup verifies Chromium can *launch* (ensure_playwright_browser,
#    setup line ~507) and exits 1 BEFORE it wires the skills if the launch fails — and launching needs
#    the `--with-deps` system libraries. So Chromium + its libs must be in place first, or setup aborts
#    with the skills unwired. (This ordering was the install bug found on the first box run.)
say "installing deps + Playwright Chromium (with system libs)…"
( cd "$GSTACK_DIR" && bun install --frozen-lockfile )
# Fail loudly: if Chromium can't install, ./setup's ensure_playwright_browser exit-1s BEFORE wiring the
# skills, so the whole install is useless — don't pretend it merely "defers" (code review P2-4).
( cd "$GSTACK_DIR" && bunx playwright install --with-deps chromium ) || {
  say "ERROR: Playwright Chromium install failed — ./setup won't wire the skills without a launchable"
  say "       Chromium. Fix the box's browser deps and re-run."; exit 1; }

# 5. ./setup — wires the individual skills into ~/.claude/skills/.
#    --no-prefix = short names (/qa, /review — what supervisor.sh calls); --quiet + non-TTY = no prompts.
say "running gstack ./setup…"
( cd "$GSTACK_DIR" && ./setup --no-prefix --quiet )

# 6. verify the wiring the lane depends on.
say "verifying…"
"$GSTACK_DIR/bin/gstack-config" get proactive >/dev/null 2>&1 && say "  gstack-config OK"
if [ -f "$HOME/.claude/skills/review/SKILL.md" ]; then say "  /review skill wired OK"; else say "  WARN: /review skill not found after setup"; fi
if [ -f "$HOME/.claude/skills/qa-only/SKILL.md" ]; then say "  /qa-only skill wired OK"; else say "  WARN: /qa-only skill not found after setup"; fi
say "done. The lane's supervisor.sh will now run the full RPIV gate."
