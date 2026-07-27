# FB-029 — Modernisation Engine (Project Greyfriars Bobby): six-agent pipeline (phased)

**Phase:** — (separate venture/repo; phased) · **Depends on:** Archon V2 base ·
**Repo:** `wealthcx01/modernisation-engine` (separate repo; ticket tracked from fountainbridge)
**Branch:** `fb-029-modernisation-engine-pipeline` · One ticket = one branch = one PR (Phase 1 MVP).

## Why this matters (for the founder)
This is the engine behind the Modernisation venture: point it at an old, hard-to-use software
interface and it produces a modern one — automatically, and checking its own work. The valuable
part is that every time it corrects itself, we learn from it, and that accumulated know-how becomes
a moat no competitor can copy. This ticket builds the first working version.

## Context
**Project Greyfriars Bobby** — the Modernisation Engine — is a **separate venture on its own
repo** (`wealthcx01/modernisation-engine`), built on an **Archon V2** base. It runs a
**six-agent pipeline**: **parse → map → generate → verify → refine → deploy**, with a
**self-correction loop** and **Supabase capture of refinement trajectories** (the moat: the record
of *how* the engine fixed its mistakes). This is **large and phased** — this ticket defines the
whole shape but **scopes the PR to a Phase-1 "Colombia sprint" MVP**. Reasoning standardises on
**Claude via the SDK** (portfolio standard).

## Scope (Phase 1 — "Colombia sprint" MVP)
- **Scaffold the six-agent pipeline** on the Archon V2 base: the stages **parse → map → generate →
  verify → refine → deploy**, wired end-to-end even if individual stages are thin for v1.
- **Self-correction loop:** `verify` failures feed `refine`, which re-attempts — a working loop,
  not a single pass.
- **Refinement-trajectory capture (the moat):** persist each self-correction trajectory to
  **Supabase** (what was wrong, what the refine step changed, the outcome) so the data asset starts
  accumulating from day one.
- **Reasoning on Claude via the SDK** across the agents.
- **Phase-1 test target:** run against **3–5 public WSDLs**, with a **90% parity threshold** as the
  success bar for the MVP. Report parity per WSDL.
- Basic run reporting / fail-loud surfacing of each stage (non-negotiable 10 in spirit).

## Out of scope (later phases — note, do not build here)
- Production `deploy` hardening, scale-out, and non-WSDL input types.
- Broadening beyond the 3–5 test WSDLs / raising the parity bar past MVP.
- Full moat analytics/productisation of the trajectory data (capture now; exploit later).
- Any fountainbridge-studio UI for the engine (separate repo; separate concern).

## Acceptance criteria (Phase 1)
- [ ] The six-agent pipeline (parse → map → generate → verify → refine → deploy) runs end-to-end
      on the Archon V2 base.
- [ ] The self-correction loop demonstrably re-attempts on a verify failure.
- [ ] Refinement trajectories are captured to Supabase.
- [ ] The engine is tested against 3–5 public WSDLs and reaches the 90% parity threshold on the
      MVP set, with per-WSDL parity reported.
- [ ] Reasoning runs on Claude via the SDK.

## Verification
/plan-ceo-review + /plan-eng-review before build (large/phased); /review + /qa; parity report over
the test WSDLs. Later phases tracked as their own tickets in `wealthcx01/modernisation-engine`.
