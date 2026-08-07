#!/usr/bin/env bash
# Install ActiveGraph on a venture box (FB-110) — the event-sourced runtime the lane can use for
# durable, forkable, replayable runs. https://github.com/yoheinakajima/activegraph
#
# Idempotent; run once per box, re-run to repair or to upgrade after bumping the pin.
#
# ## Two things worth knowing before changing this
#
# 1. **This is NOT the studio's approval gate.** The studio has its own thing called ActiveGraph — a
#    signed approval record (FB-051/FB-071) that CLAUDE.md non-negotiable 4 rests on. They share a
#    name and nothing else. Installing this changes no gate. FB-111 renames the in-house one so the
#    collision stops costing anyone a double-take.
#
# 2. **A virtualenv, deliberately.** Debian and Ubuntu mark the system Python externally-managed
#    (PEP 668) and refuse a bare `pip install`. The tempting fix is `--break-system-packages`, and it
#    is how a provisioning script quietly breaks apt months later on a machine nobody is watching.
set -euo pipefail

# Pinned for the same reason gstack is: third-party code, installed as root on a box that holds a
# repo-write token, must be reproducible rather than whatever `main` happened to be that morning.
# Upgrades are deliberate — bump this and re-run.
: "${ACTIVEGRAPH_PIN:=1.10.0}"
: "${ACTIVEGRAPH_HOME:=/opt/activegraph}"
# `[llm]` brings the Anthropic provider, which is what the lane runs on. The core alone would install
# and then be unable to do the one thing a founder's venture needs it for.
: "${ACTIVEGRAPH_EXTRAS:=[llm]}"

say() { echo "[install-activegraph] $*"; }

# 1. Python 3.11+ — the library requires it, and a box that cannot meet that should say so now rather
#    than fail halfway through a pip resolve with a wall of red.
if ! command -v python3 >/dev/null 2>&1; then
  say "installing python3…"
  apt-get update -qq
  apt-get install -y -qq python3 python3-venv
fi
PY_OK=$(python3 -c 'import sys; print(1 if sys.version_info >= (3, 11) else 0)')
if [ "$PY_OK" != "1" ]; then
  echo "ActiveGraph needs Python 3.11 or newer; this box has $(python3 --version 2>&1)." >&2
  echo "Upgrade the box's Python before re-running." >&2
  exit 1
fi
say "python $(python3 --version 2>&1 | cut -d' ' -f2)"

# `venv` is a separate package on Debian and its absence only shows up at venv-creation time.
python3 -c 'import venv' 2>/dev/null || {
  say "installing python3-venv…"
  apt-get update -qq
  apt-get install -y -qq python3-venv
}

# 2. The virtualenv. Created once; re-runs reuse it, which is what makes this safe to run again.
if [ ! -x "$ACTIVEGRAPH_HOME/bin/python" ]; then
  say "creating the virtualenv at $ACTIVEGRAPH_HOME…"
  python3 -m venv "$ACTIVEGRAPH_HOME"
fi

say "installing activegraph==$ACTIVEGRAPH_PIN$ACTIVEGRAPH_EXTRAS…"
"$ACTIVEGRAPH_HOME/bin/pip" install --quiet --upgrade pip
"$ACTIVEGRAPH_HOME/bin/pip" install --quiet "activegraph$ACTIVEGRAPH_EXTRAS==$ACTIVEGRAPH_PIN"

# 3. On PATH, for everyone and for systemd.
#
# `~/.bun/bin` not being on the systemd PATH cost this lane a debugging session once: the thing was
# installed, worked when a human typed it, and did not exist as far as the timer was concerned. A
# symlink into /usr/local/bin is on the default PATH of both.
if [ -x "$ACTIVEGRAPH_HOME/bin/activegraph" ]; then
  ln -sf "$ACTIVEGRAPH_HOME/bin/activegraph" /usr/local/bin/activegraph
fi

# 4. Prove it, rather than assume it.
#
# An installer that exits 0 having done nothing useful is the failure mode this lane keeps meeting
# (see the box-install gotchas: exec bits, $HOME under set -u, blank-placeholder greps). The version
# it reports is the version that will run.
if ! INSTALLED=$(/usr/local/bin/activegraph --version 2>&1); then
  echo "activegraph installed but will not run:" >&2
  echo "$INSTALLED" >&2
  exit 1
fi
say "ready: $INSTALLED"
say "try it: activegraph quickstart   (bundled demo, no API key, ~30s)"
