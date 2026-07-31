# FB-051 — Full ActiveGraph runtime for external actions (fully apply ActiveGraph)

**Status:** In progress · **Phase:** 4b · **Depends on:** FB-044 (git-backed gate + executor), FB-046
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

**None of these are met. The PR is a draft.** A 10-specialist review (2026-07-31) returned 27
critical findings across this branch and FB-054; the three below were each independently reproduced
by more than one reviewer *running the code*, not reading it. The ticked boxes and the confident
prose that were here before were written by the same person who wrote the bugs, and were wrong.

- [ ] External-action approvals are ActiveGraph events, replayable and actor-attributed.
      **NOT MET — the native event log is never read in production.** Nothing writes an
      `approval.proposed` event: the lane writes `proposal.json`, the studio writes only
      `approval.granted`, the executor only `executing`/`executed`/`rejected`. So every real log
      opens with `granted`, and `logFor`'s own guard
      (`if (ordered(events)[0]?.type !== 'approval.proposed') return bridged`) discards the entire
      native log in favour of the file-derived reconstruction. Verified independently by the
      maintainability and testing reviewers, both by executing `loadApprovals` against the real
      production file shape: result `bridged: true`, lineage rebuilt from files with empty
      timestamps. `reconcile()`, `REACHED` and `furthest()` are unreachable code.
- [ ] The human grant is the only path to `granted`.
      **NOT MET — the gate reads a self-declared field.** `isHuman()` checks `actor.kind`, which
      lives inside a JSON file the lane holds repo-write on. A lane writing
      `{type:'approval.granted', actor:{kind:'founder', id:'john@bruntsfield.capital'}}` projects to
      `granted`/`executed` with `faults: []` and `isDefensible() === true`. Nothing in the studio
      ever verifies the HMAC attestation. Confirmed by security, testing and red team (×3).
      The bridge is worse: `approverActor()` hard-codes `kind: 'founder'`, so *any* `grant.json` —
      including `{}`, which yields "granted by founder unknown" — launders into a human grant.
      The existing test only proved the gate against an adversary that honestly labels itself `lane`.
- [ ] The studio and executor operate on the event stream; v0 is bridged.
      **NOT MET** — see the first criterion. The events are write-only.

## Review findings (2026-07-31) — what must be resolved before this can ship

Ranked. Each was confirmed by executing the code.

1. **Gate bypass — forged human grant.** `lib/activegraph.ts` / `lib/activegraph-bridge.ts`. Fix
   direction: the studio holds `FOUNDRY_APPROVAL_SECRET`; verify the attestation over
   `{id, proposal_sha, approver}` before any `approval.granted` may transition, and treat
   `kind: 'founder'` in an unverified file as a claim, not an authorization.
2. **Log downgrade.** `readEvents` accepts any numeric `seq`, so one lane-written `{seq: 0}` file
   sorts first, fires the mid-story branch, and discards the authentic log for the unauthenticated
   bridge path. Verified: `grantedBy` became `attacker@evil.com` with no fault.
3. **Confused deputy — the founder approves a different document than the executor sends.** The card
   renders `projected.summary`/`department`/`compliance` from the lane-authored event, while the
   attestation pins `proposal.json`'s blob sha and the executor acts on `proposal.json`. Nothing
   binds the two. FB-044's sha-pin existed to make display and execution the same artefact; this
   branch broke that alignment.
4. **`reconcile()` is wrong three ways** (added in this branch's own review round): its `furthest()`
   guard early-returns in precisely the scenario it was written for, so a genuinely human-granted,
   genuinely executed send displays as `proposed` at the top of the attention queue; it appends
   repaired events out of causal position, manufacturing blocking faults on sound records; and its
   `repaired` marker never reaches `ActiveGraphApproval`.
5. **Grant pre-squat.** The event path is deterministic and `putFile` omits `sha`, so a lane that
   writes `0002-granted.json` first causes the real human grant event to 422 — into a bare `catch {}`
   — while the founder is told "Approved." Nothing records that the audit write failed.
6. **Denial-of-gate.** Any blocking fault withholds Approve, and one junk event manufactures one.
   Files are immutable, so there is no in-band repair: a lane can freeze every external action for a
   venture. Needs a recorded, human-authorised repair event.
7. **`approval.failed` is never written.** The status was added here and justified as the fix for
   v0's misrepresentation, but no code path emits it. A throw in `performAction` leaves
   `execution.json` at `executing`, and the early-return at the top of `handleApproval` means it
   stays in-flight forever with no alert — the silent failure non-negotiable 10 forbids.
8. **Executor seq handling corrupts the log.** `readEventSeq` catches a transient GitHub error and
   returns 0 (re-introducing the exact conflation `gh()` was hardened against), restarting the
   sequence and producing a permanent duplicate-seq in an append-only log. `causedBy: seq - 1` is
   fabricated rather than observed. Three writers share the seq space with no coordination.
9. **A seq collision silently discards the later event** — so a lane that pre-writes a seq can make
   the founder's genuine grant vanish, projecting back to `proposed`.
10. **Performance.** `1 + N*(4+M)` GitHub API calls per venture page render (50 approvals × 6 events
    = 501 requests against a ~900/min secondary limit), fully serialized (~18s TTFB at N=50), and
    the only loader on that page with no cache. Terminal approvals — immutable by construction — are
    re-read in full on every refresh.
11. **Privacy.** `lineage` and `compliance` are serialized into the RSC payload for `VentureBoard`
    (a client component) with zero consumers, which pushes `compliance.recipient` — a real person's
    email — into the browser.
12. **The evidence fields are never rendered.** `bridged`, `grantedBy`, `grantedAt`, `lineage`,
    `compliance` and `isDefensible()` have no consumer, so a laundered or repaired record is
    displayed identically to a natively attested one — and in every forgery above, `faults` is empty
    and the status reads a confident `granted`.
13. **The fault gate is client-side only.** `approveExternalAction` never projects, so the
    "record cannot be verified" state is a property of the button, not of the system.

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
