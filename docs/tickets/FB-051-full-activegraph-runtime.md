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

**Narrowed, on John's call (2026-07-31), after a ten-specialist review.** The ticket asked for an
event-sourced runtime whose projection enforces the human gate. That cannot be built on this
substrate, because the log lives on a ref the proposing lane can write — so the projection could
enforce nothing, and the design doc's claim that "a forged grant cannot even project to `granted`"
was false. What ships instead verifies the one thing that IS unforgeable and is honest about the rest.

- [x] **The studio verifies what it can prove.** `lib/provenance.ts` recomputes FB-044's HMAC
      attestation over `id|proposal_sha|approver` — the studio issues those and holds the secret,
      which the lane never does. Three states, never guessed between: `attested` (provably issued by
      the studio, for this exact proposal, naming this approver), `unattested` (a grant record that
      does not verify — shown as unverified, never as a human's approval, and the executor refuses
      it), `none`.
- [x] **An unattested grant does not read as granted.** It stays `proposed`, and the card says the
      studio cannot verify it and why: no attestation, a bad signature, no approver, or a proposal
      that changed after approval. The last is the TOCTOU protection the executor already relied on,
      surfaced to the founder rather than discovered at execution time.
- [x] **Display and attestation describe the same artefact.** Every founder-visible field is read
      from the sha-pinned `proposal.json` — the thing the attestation covers and the executor
      performs. The event-sourced version rendered the summary from a lane-written event, so a
      founder could approve one document and the executor send another.
- [x] **A failed execution reads as `failed`**, and the executor now writes it. The status was
      defined here and written by nothing: a throw in `performAction` left `execution.json` at
      `executing` forever, and the early-return skipped it on every later pass — a half-completed
      real send shown as permanently in-flight, with no alert.
- [ ] ~~The append-only log is the audit record, replayable and actor-attributed.~~ **Withdrawn.**
      It cannot be, on a ref the audited party can write. `lib/activegraph.ts` and
      `lib/activegraph-bridge.ts` are deleted.

## What was removed, and what that fixed

Deleting the projection removed the defects it carried, rather than guarding them:

| Removed | Defect it took with it |
| --- | --- |
| `actor.kind` as the gate | A lane writing `{kind:'founder'}` projected to `granted`, faults empty |
| The bridge's hard-coded `founder` | Any `grant.json` — including `{}` — laundered into "granted by founder unknown" |
| `logFor` / `reconcile` / `REACHED` | Unreachable code that discarded authentic logs on a `{seq:0}` file, and whose repair produced blocking faults on sound records |
| Reading the event log per render | 1 + N×(4+M) GitHub calls per venture page (~501 at N=50), serialized, uncached |
| `lineage` / `compliance` on the client | `compliance.recipient` — a real person's email — serialized into the browser payload for zero consumers |
| Fault-based button withholding | One junk event froze every external action for a venture, with no in-band repair |
| The studio's event append | A silently-swallowed 422 told the founder "Approved" while the audit write did not happen; a lane could pre-squat the path |

**The events themselves are gone from the studio's read and write paths.** The executor still appends
an operational trace for an operator reading the ref; nothing depends on it and nothing claims
anything about it.

## Still open
- ⚠ **The spend/outcome records remain lane-authored.** The attestation covers `id|proposal_sha|
  approver` and nothing else — not `granted_at`, not the execution record. A lane can still write
  `execution.json {status:'rejected'}` over its own grant. Widening the signed payload is the next
  real step, and FB-054's reported figures depend on it too.
- ❌ **The approve click is not bound to the proposal the founder saw.** `proposalSha` is computed
  and unused; the server action re-reads and signs whatever is current, so a pre-grant swap is
  unguarded. The verification above catches it AFTERWARDS (the sha no longer matches) but does not
  prevent it.

## Verification
20 unit tests over provenance and the approval read path: a forged grant refused and its named
approver suppressed; a grant signed for another approval, another approver, another proposal sha or
another secret all refused; no-secret reported rather than trusted; `none` distinguished from
failure; a failed execution read as `failed`; and every founder-visible field read from the pinned
proposal. 140 tests, lint, typecheck, build, UI gate (34), ticket parse, manifest validation,
shellcheck.

**Not yet run on ARCA's box.** The verification path needs `FOUNDRY_APPROVAL_SECRET` set on the
studio — the same value the executor holds. Until it is, every grant reads `unattested`, which is the
correct failure direction but means the founder sees a warning on real approvals.
