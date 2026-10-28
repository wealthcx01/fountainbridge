# Factory operations

This application runs on a pinned Archon SDLC source. See
[factory/MIGRATION.md](factory/MIGRATION.md) for installing and upgrading it.

Shared workflow gates own every decision. Inspect a run's identity and status
before responding to a declared gate.

Project runtime scenarios: `harness/END-TO-END.md`.
Holdout scenarios: `.factory/holdout/HOLDOUT.md`.
Ordinary checks: `python harness/ci.py`.
A test copy, with its own throwaway database: `node scripts/test-copy.mjs start --port <port>`
(see `harness/runtime.inputs.json` and the README).

Record this application's tested source SHA, candidate, run IDs, coverage,
fresh-environment evidence and open integration limits here after testing.
