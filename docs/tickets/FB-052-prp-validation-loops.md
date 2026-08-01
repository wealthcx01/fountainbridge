# FB-052 — PRP + validation loops (fully apply Cole Medin / Rasmus's PRP)

**Status:** Done · **Phase:** 3 · **Depends on:** FB-041 (the lane loop), FB-050 (gbrain) · **Repo:**
fountainbridge · **Branch:** `fb-052-prp-validation-loops` · One ticket = one branch = one PR.

**Design:** `docs/lane-rpiv-loop.md` §"The PRP and its validation loop".

## Why this matters (for the founder)
The agents get the work right the first time more often, because before building they assemble the
right context and write down exactly how "done" is checked — then check it. Fewer wrong turns, less
re-work, higher-quality shipping.

## Context
The Bruntsfield Loop (`docs/jstack-bruntsfield-method.md`) puts Cole/Rasmus's **PRP (Product Requirement
Prompt: rich context + explicit validation gates)** at the PLAN step. FB-041 runs `/plan`; this ticket
makes that plan a real PRP and enforces its validation loop — Cole Medin's method, **fully applied**.

## Scope (fully applies PRP + RPIV validation)
- The PLAN step emits a **PRP**: the ticket's intent + **context gathered from gbrain** (examples, prior
  tickets, `context/`) + **explicit validation gates** ("happy path, edge cases, errors, coverage").
- **Tasks derive from the PRP** with observable acceptance criteria (the ticket scope's checklist).
- The **validation loop runs** (the PRP's gates → `/qa` + tests) before the item reaches the human gate;
  a failed gate loops back to IMPLEMENT, not forward.
- **Resume-from-the-board** property (Archon): the ticket + PRP are the durable context, so a fresh lane
  session resumes from `docs/tickets/` state without chat history.

## Out of scope
- The gstack install/loop mechanics (FB-041). The knowledge index (FB-050).

## Acceptance criteria
- [x] A worked ticket produces a PRP with context + validation gates — enforced, not hoped for:
      `prp_ok` blocks a plan that declares none, and the gates + their ✅/❌ results go in the PR body
      and the RunReport. The full PRP persists to `$STATE_REF:prps/<slug>.md`.
- [x] The validation loop gates the PR: a failed gate, a test regression the lane caused, or a
      `/review` that won't clear it loops **back to IMPLEMENT** with the failure quoted, bounded by
      `MAX_VALIDATION_ROUNDS` (default 2). Rounds exhausted ⇒ `blocked`, no PR.
- [x] A fresh lane resumes from the board + PRP alone — `read_prp` restores it and the lane skips
      planning. Round-tripped in `__tests__/prp-resume.test.mjs` (wrapped base64, UTF-8 included).

## Verification
**Done in this PR (local):** 32 unit tests over the PRP logic — shape validation, gate extraction
(including that Tasks checkboxes are not mistaken for gates), unreported-gate-means-failed, the
founder-facing report, and the persistence round-trip against a stubbed contents API. The bash
interface (`prp_ok`, `prp_problems`, `prp_gate_count`, `prp_gate_list`, `prp_gate_report`,
`prp_gate_summary`) exercised end to end, including under a minimal systemd-like environment with no
`HOME`, and every CLI exit code pinned as the bash↔JS contract (0 pass / 1 not-a-PRP / 4 gate failed
/ 2 usage). A second review round closed the ways a gate could report a pass it had not earned — an
empty gate list, a PRP edited after acceptance, a `PUT` that 409'd unnoticed, a stored PRP resumed
against a ticket whose text had since changed, and `prp_problems` taking the lane down with it under
`set -euo pipefail`. 169 tests, lint, typecheck, build, the Playwright UI gate (34), ticket parse,
manifest validation and shellcheck all green.

**Still to do on ARCA's box (needs John):** watch one real ticket produce a PRP and pass, and one
deliberately-failing gate loop rather than ship. The loop's control flow is bash that only runs with
Claude auth, a venture repo and the GitHub API — unit tests cover its pieces, not the whole path.
