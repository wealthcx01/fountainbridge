# FB-050 — gbrain semantic brain on the venture box (fully apply gbrain + Cole's Archon RAG)

**Status:** Done · **Phase:** 2/3 · **Depends on:** FB-043 (context/library in git) · **Repo:**
fountainbridge (+ venture VM) · **Branch:** `fb-050-gbrain-on-venture-box` · One ticket = one branch = one PR.

**Design:** `docs/venture-brain.md`.

## Why this matters (for the founder)
The more your venture knows, the smarter every piece of work gets — the agents *search* everything
you've told them and everything already built, instead of re-reading raw files. This is the venture's
real memory.

## Context
FB-043 put the founder's knowledge in git `context/`/`library/` and the lane reads files directly —
the substrate, not the brain. D8 + the method doc (§5) say **gbrain indexes git and plays Archon's RAG
role**. This applies gbrain **fully**: install it on the box and make retrieval semantic, per-venture,
per-department.

## Scope (fully applies gbrain / Archon RAG)
- **Install gbrain on the venture box** + register the venture repo as a source; build the index
  (`context/`, `library/`, `docs/tickets/`, and code) with the per-department partitions (D8 —
  build/sell/scale).
- **The lane's RESEARCH uses `gbrain search`/`query`** (semantic), not raw file reads (upgrades FB-041's
  RESEARCH step).
- **The composer can query gbrain** too (so its answers + shaped tickets reflect the whole brain, not
  just per-chat uploads) — closing the last of the FB-034 silo (LibreChat cache defers to gbrain/git).
- **Auto-refresh**: gbrain autopilot / a sync on merge so the index tracks the repo.

## Out of scope
- The deposit path (FB-043, done). The gstack loop (FB-041). Cross-venture indexes (D1 — never).

## Acceptance criteria
- [x] gbrain installed + indexing the venture repo on the box, per-department partitioned.
      (`install-gbrain.sh` + `gbrain-refresh.sh`; partitioning in `brain-lib.mjs`, unit-tested.
      **The box run itself is still outstanding** — see Verification.)
- [x] The lane RESEARCH step answers from `gbrain query` (a deposited fact is retrieved semantically,
      not by filename) — `supervisor.sh` §4 via `brain_research`, with a loud file-read fallback.
- [x] The composer can surface a gbrain answer (`brain-mcp` → host bridge); the index refreshes after
      a merge (every lane wake, plus `foundry-brain-sync.timer`).

## Verification
**Done in this PR (local):** the full query path exercised end to end against a real gbrain —
ticket → question → `gbrain call query` → department partition → digest; the bridge's auth, routing
and error paths (401/404/405/400); the MCP server's handshake, `tools/list`, a live `tools/call`, and
each failure mode (no token, wrong token, bridge down) returning plain-language text; the lane's
`brain_research` helper returning a digest and degrading to rc=1 when gbrain is absent. 20 unit tests
on the partition/digest/question logic; lint, typecheck, full test suite and shellcheck green.

**`/review` (staff-engineer audit + security, testing, maintainability and adversarial passes).**
27 findings actioned. The ones that would have broken the box install, each confirmed by execution
or by reading the cited line:

- The new scripts shipped mode 644 while `run-once.sh` gated the refresh on `[ -x ]` — the lane's
  brain refresh would have silently never run. Executable bit set; the guard no longer depends on it.
- `foundry-lib.sh` expanded `$HOME` unguarded under `set -u`. A system unit without `User=` is not
  guaranteed `$HOME`, so sourcing would abort and take the **whole autonomous lane dark** — the exact
  failure PR #49 fixed for the timer. Every expansion is now default-guarded.
- `.env.example` ships `FOUNDRY_BRAIN_TOKEN=` blank and the installer matched the key, not a value —
  so the documented `cp .env.example .env` flow would have skipped writing the real token and printed
  success, leaving the composer permanently "not yet authorized".
- The installer ran the first index under `set -e` *before* writing `brain.env`, the token and the
  units. Any indexing failure left a box with no state at all, and a re-run failed identically.
- `gbrain list -n 500` — `-n` is not a gbrain flag; it silently returns the default 50 (verified:
  `-n 3` → 50 rows, `--limit 3` → 3). Most departmental pages would have gone untagged.
- The department partition widened to the *whole brain* on an unrecognised department, and the
  digest's `<venture-knowledge>` delimiter was forgeable by any indexed page.
- `expand: true` contradicted the design doc and needs an expansion model a venture box doesn't have;
  the partition ran *after* gbrain's limit, so another surface's pages could crowd out a lane's own.
- Docs claimed the brain lives at `/opt/foundry/brain`; it is `~/.gbrain/brain.pglite`. Docs claimed
  `docker compose up -d` picks up the token; this repo's own README records that it must be
  `--force-recreate`.

Also: the refresh now runs via systemd rather than an inline `timeout` that would SIGTERM gbrain
mid-write, the sync timer no longer collides with the lane wake, Ollama is memory-capped, 401s are
logged, and the lane distinguishes "the brain had nothing" from "the brain is unavailable".
Known gaps deliberately left, with reasons, are in `docs/venture-brain.md` §9 — the worktree/indexer
race is the one worth its own ticket.

**Still to do on ARCA's box (needs John — same access as the FB-041 bring-up):** run
`install-gbrain.sh`, deposit a fact through the composer (FB-043), merge it, then confirm
`brain-query.mjs --question "…"` returns it *without* naming the file, and that a lane run's PR body
reads `Research: brain (semantic)`. Until that runs, the box side is unproven.
