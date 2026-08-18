# FB-110 — ActiveGraph on the venture box

**Status:** Done · **Phase:** 3 · **Asked for by:** John, 2026-08-07 — *"make sure active graph is
installed following this guidance for our founders"*, pointing at a post by
[@yoheinakajima](https://x.com/yoheinakajima). · **Repo:** fountainbridge (provisioning) ·
**Branch:** `fb-110-activegraph-on-the-venture-box` · One ticket = one branch = one PR.

## The name collision that had to be settled first

**ActiveGraph is a real open-source project** — `pip install activegraph`, an event-sourced reactive
graph runtime for long-running, auditable agentic systems
([repo](https://github.com/yoheinakajima/activegraph), [docs](https://activegraph.ai)).

**This studio already has something called ActiveGraph**, and it is not that: a bespoke TypeScript
approval record (FB-051/FB-071) — `approval.proposed` → `approval.granted`, HMAC-signed with
`FOUNDRY_APPROVAL_SECRET`, projected with a rule that refuses any grant no human issued. It is
load-bearing for CLAUDE.md non-negotiable 4.

Same name, same central idea (append-only events, approvals as first-class events), different code.
John's decision, 2026-08-07: **install the library on the venture boxes; leave the studio's approval
gate exactly as it is.** The rename of the in-house one is FB-111, so that "ActiveGraph" can mean the
library without ambiguity.

## What the founders get from it

The library is for the *lane* — the thing doing the work on the venture's own machine — not for the
studio's gate:

- **Durable runs.** A lane's work persists to an event log and resumes deterministically, rather
  than starting from nothing after a restart.
- **Forkable and replayable.** Branch a run at any past event and re-run it differently, with the
  shared prefix cached so it does not re-pay for the same model calls.
- **A trace that is the audit.** Every change, including failures, is a first-class event.

That is a good fit for the circuit-breaker reality FB-098 surfaces to founders — "tried 3 times and
stopped" is exactly the kind of thing a replayable log makes cheap to understand.

## Scope

- An installer, `deploy/lane/install-activegraph.sh`, in the shape of the existing ones: idempotent,
  **version-pinned**, re-runnable to repair or upgrade.
- **A virtualenv, not system pip.** Debian and Ubuntu mark the system Python externally-managed
  (PEP 668) and refuse a bare `pip install`; a box-wide `--break-system-packages` to work around that
  is how a provisioning script quietly breaks apt later.
- The CLI on `PATH`, because `~/.bun/bin` not being on the systemd `PATH` has already cost this lane
  a debugging session once.
- Verified after install rather than assumed — the installer fails loudly if the CLI does not run.

## Explicitly NOT here

- **Wiring the lane's RPIV loop onto ActiveGraph.** Installing it and adopting it as the runtime are
  different jobs; the second is a design change to how every venture's work is executed.
- **Anything touching the studio's approval gate.** John's decision was explicit.
- **Running the installer on the live ARCA box.** The change ships here; applying it to a running
  venture is a deliberate act with John's say-so, not a side effect of a merge.

## Acceptance criteria

- [x] `deploy/lane/install-activegraph.sh` installs a pinned ActiveGraph, idempotently, into a venv.
- [x] It refuses to report success if the CLI is not runnable afterwards.
- [x] It passes `make provision-lint` (shellcheck + syntax) like every other provisioning script.
- [x] The pin and the upgrade path are written down where the next person will look.

## Pinned at 1.10.0, checked rather than assumed

A search result said `1.0.5.post1`; PyPI says **1.10.0**, `requires_python >=3.11`. The pin is the
verified one. `ACTIVEGRAPH_PIN`, `ACTIVEGRAPH_HOME` and `ACTIVEGRAPH_EXTRAS` are all overridable, so
an upgrade is a bump and a re-run.

`[llm]` is in the default extras on purpose: the core alone installs cleanly and then cannot do the
one thing a founder's venture needs it for.

## Installed on ARCA, 2026-08-18 — and the first run failed

Run on `venture-arca` (Ubuntu 24.04.4, Python 3.12.3) with John's say-so. It failed, for a reason
worth recording because it is this lane's recurring shape:

    python3 -c 'import venv'      # PASSES — venv is stdlib, always importable
    python3 -m venv /opt/...      # FAILS  — ensurepip ships in the separate python3-venv package

**The guard was green and the thing it guarded was broken.** Same family as every entry in the
box-install gotchas: a check that looks like verification and verifies nothing. The check now tests
`ensurepip`, which is the actual prerequisite, and re-checks after installing the package rather than
assuming apt succeeded.

The failure also left a **half-built venv**, and the script claimed to be re-runnable *to repair* —
but its "already done?" test was `-x bin/python`, which the broken venv satisfied. It now tests for
`bin/pip` and rebuilds anything incomplete, because repairing from a broken state is the entire point
of being re-runnable.

Both defects were found by running it on a real box. Neither was reachable from lint, and CI is green
on this script either way.

### The verified result

| | |
| --- | --- |
| Version | `activegraph 1.10.0` |
| On `PATH` for a login shell | yes |
| **On `PATH` for systemd** | **yes** — the trap that cost this lane a debugging session |
| Footprint | 78 MB in `/opt/activegraph` |
| `activegraph quickstart` | ran end to end, exit 0, real memos and event log |
| Lane, brain bridge, 5 LibreChat containers | unchanged and healthy afterwards |

## Still to happen, and deliberately not here

~~No running box has been touched.~~ **Installed on ARCA 2026-08-18** (above). Nothing about the
studio, the lane's current loop, or the approval gate changed: the library is present and idle until
something is written to use it.

Adopting ActiveGraph as the lane's actual runtime is the larger, separate question this ticket
explicitly did not answer.
