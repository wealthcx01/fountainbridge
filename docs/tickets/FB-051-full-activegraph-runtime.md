# FB-051 — Full ActiveGraph runtime for external actions (fully apply ActiveGraph)

**Status:** In review · **Phase:** 4b · **Depends on:** FB-044 (git-backed gate + executor), FB-046
(in-studio approve) · **Repo:** fountainbridge (+ ActiveGraph) · **Branch:** `fb-051-full-activegraph-runtime`
One ticket = one branch = one PR.

## Why this matters (for the founder)
Every outside action — every email, every deploy — is a permanent, replayable record: who proposed it,
what it was, who approved it, when, on what lawful basis. Defensible to a regulator or a bank, by
construction. It's the difference between "we have a log" and "we can prove exactly what happened."

## Context
FB-044 shipped a **minimal git-backed** approval gate (proposed/granted/executed as files + an HMAC
attestation) — the right shape, deliberately not the full runtime. `docs/research-gtm.md` §5 specifies
the real **ActiveGraph**: `approval.proposed → approval.granted` as first-class lifecycle events, an
**immutable append-only event log that IS the audit log**, actor attribution + causal lineage per
event, deterministic replay. This applies ActiveGraph **fully**.

## Scope (fully applies ActiveGraph)
- Move the gate from git-backed files to the **ActiveGraph event-sourced runtime** (per venture): emit
  real `approval.proposed`/`approval.granted`/`approval.executed` events; the append-only log is the
  audit record (replayable, actor-attributed).
- The **compliance record as events** (research-gtm §5): recipient PECR classification, lawful basis /
  LIA reference, suppression-check result, frozen draft, sending identity + scope, approver + timestamp.
- The studio Approve (FB-046) and the executor (FB-044) write/read ActiveGraph events instead of git
  files; the attention queue renders from the event stream.
- Unsubscribes/objections write back to the suppression list as events.

## Out of scope
- The actual send transport (Phase 4b send tickets wire Postmark/Workspace into the executor's
  `performAction()`). The engineering PR gate (stays git/CI).

## Acceptance criteria
- [x] External-action approvals are ActiveGraph events (proposed→granted→executed), replayable and
      actor-attributed. Status is now a **deterministic projection** of an append-only log
      (`lib/activegraph.ts`), never inferred from which files exist. `replayTo(events, seq)` gives the
      state as it stood at any point — a pure fold, so replay *is* the historical truth rather than a
      reconstruction of it.
- [x] A send approval carries the full §5 compliance record (recipient, PECR subscriber class, lawful
      basis + LIA/consent ref, suppression check, frozen `draftSha`, channel, sending identity +
      scope; approver + timestamp from the grant event), frozen on `approval.proposed`. **The human
      grant is the only path to `granted`** — an `approval.granted` by a `lane`/`executor`/`system`
      actor does not transition the approval at all; it projects to `proposed` plus a
      `non-human-grant` fault. Defence in depth alongside FB-044's HMAC: the attestation stops a lane
      *producing* a valid grant, the projection stops a forged one *counting*.
- [~] The studio and executor operate on the event stream: `loadApprovals` projects from it, the
      studio's Approve appends `approval.granted`, and the executor appends
      `executing`/`executed`/`rejected`. The git-backed v0 is **bridged, not retired** —
      `lib/activegraph-bridge.ts` derives the event chain from FB-044's files, marks the result
      `bridged: true` (reconstructed order is not recorded order), and both paths are still written.
      Retiring v0 needs every venture migrated *and* the deployed executor updated, which is a
      migration, not a code change. Called out in the design doc's "Still to do".

**Design:** `docs/activegraph-runtime.md`.

## Note on "the ActiveGraph repo"
Upstream (github.com/yoheinakajima/activegraph) is a **Python** event-sourced graph runtime. Adopting
it directly would mean a Python service plus a datastore per venture, against D1/D2 (git is the
store) and the studio's TypeScript stack. What this ticket applies is the *model* the ticket's own
Context asks for — append-only log as source of truth, state as projection, actor attribution, causal
lineage, deterministic replay — on our substrate: immutable event files on the `foundry-approvals`
ref. Nothing new to provision per venture.

## Verification
**Done in this PR (local):** 34 unit tests. The proposed→granted→executed sequence replaying with
correct actor lineage at every point (the ticket's stated verification); determinism and
order-independence; the §5 record surviving the fold; the human-grant gate (lane-forged, executor
self-granted, and the legitimate Bruntsfield approver under D7); and every way a log can fail to hold
up — no proposal, execution that never passed a grant, events after a terminal state, duplicate
`seq`, broken lineage, a second proposal — each reported as a fault rather than thrown or repaired.
Plus the bridge: partial v0 states, camelCase/snake_case compliance keys, a grant with no proposal,
and the rule that a v0 proposal is attributed to a **lane**, never a human. Plus `loadApprovals`
projecting from the log end to end, including the partial-migration fallback.

Two prior misrepresentations fixed on the way past: a **failed execution used to project as
`granted`** (v0's file-presence inference had no `failed` case, so an errored send showed to the
founder as approved and fine), and an unverifiable record now **withholds the Approve button** rather
than rendering a confident status over a broken chain.

164 tests, lint, typecheck, build, the Playwright UI gate, ticket parse, manifest validation and
shellcheck all green.

**Still to do (needs John / a migration):** retire the v0 files once ventures are migrated and the
deployed executor is updated; wire `suppression.added` into the send path (nothing sends until Phase
4b); a UI for walking an approval's history — `replayTo` is tested but has no operator surface.
