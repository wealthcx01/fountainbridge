# FB-051 — Full ActiveGraph runtime for external actions (fully apply ActiveGraph)

**Status:** Planned · **Phase:** 4b · **Depends on:** FB-044 (git-backed gate + executor), FB-046
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
- [ ] External-action approvals are ActiveGraph events (proposed→granted→executed), replayable + actor-attributed.
- [ ] A send approval carries the full §5 compliance record; the human grant is the only path to `granted`.
- [ ] The studio + executor operate on the event stream; the git-backed v0 is retired or bridged.

## Verification
`/review` + CI; a proposed→granted→executed sequence replays from the ActiveGraph log with correct actor lineage.
