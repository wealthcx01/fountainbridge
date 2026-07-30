# The ActiveGraph runtime for external actions

**FB-051.** How the studio records every action that reaches the outside world, and why the record is
worth trusting. Applies the model of [ActiveGraph](https://github.com/yoheinakajima/activegraph)
(Yohei Nakajima) — event-sourced, append-only log as source of truth, state as a projection — to our
substrate. Compliance requirements come from `docs/research-gtm.md` §5.

## What changed, and why it mattered

FB-044 shipped the right *shape*: `proposal.json`, `grant.json`, `execution.json` on a per-venture
`foundry-approvals` git ref, with an HMAC attestation the executor verifies. What it did not ship was
a *record*. Status was inferred from **which files happened to exist**, and that has three problems a
regulator would find immediately:

1. **"The grant file is present" is not "a human granted it."** It cannot say who, or when.
2. **A failed send read as `granted`.** With no `rejected`/`executed` status matched, the inference
   fell through to "grant exists ⇒ granted" — so a founder saw an errored send as approved and fine.
   That was a live misrepresentation, now fixed (`failed` is a real projected state).
3. **There was no order.** Three files have no sequence, so "what did the machine do before a human
   ever saw this?" was unanswerable.

## The model

An approval is an **append-only log of immutable events**. Its status is a deterministic projection
of that log — never stored, never able to drift from it.

```
approvals/<id>/events/0001-proposed.json
                      0002-granted.json
                      0003-executing.json
                      0004-executed.json
```

Every event carries:

| Field | Why it exists |
| --- | --- |
| `seq` | Monotonic per approval. Ordering survives a clone; it is in the filename too. |
| `type` | `approval.proposed` / `granted` / `rejected` / `executing` / `executed` / `failed` |
| `at` | ISO-8601 UTC |
| `actor` | `{ kind, id }` — **who**. `founder`/`bruntsfield` are human; `lane`/`executor`/`system` are not. |
| `causedBy` | The `seq` this event descends from — causal lineage, not just chronology |
| `compliance` | The §5 record, frozen on the proposal |

### Only a human can grant — enforced by the projection

Non-negotiable 4, expressed as data. `approval.granted` by a non-human actor **does not transition
the approval**. A forged grant cannot even project to `granted`; it projects to `proposed` plus a
`non-human-grant` fault. This is defence in depth alongside FB-044's HMAC attestation: the
attestation stops a lane *producing* a valid grant, and the projection stops a forged one *counting*
even if it were written.

### Faults are reported, never repaired

A log that does not hold up — no proposal, illegal transition, broken lineage, duplicate `seq`,
events after a terminal state — projects with `faults[]`. The studio renders that in front of the
Approve button and **withholds the button entirely**. Quietly "fixing" a broken chain in the
projection would destroy the one property the log exists to provide, and approving against a record
we cannot verify would produce exactly the thing this ticket prevents.

### Replay

`replayTo(events, seq)` is the state as it stood right after that event. Because projection is a pure
fold with no stored snapshot, replay *is* the historical truth rather than a reconstruction of it.

## The §5 compliance record

Frozen on `approval.proposed`, so what was approved is what was assessed:

- **recipient** + **PECR subscriber class** — `corporate` / `individual` / `sole-trader` (a sole
  trader counts as an individual; that is the trap in research-gtm §3)
- **lawful basis** — `consent` / `soft-opt-in` / `legitimate-interests`, with the consent record or
  the venture's LIA reference. One LIA per venture, referenced per send — not re-argued per email.
- **suppression check** — checked, and the result
- **draftSha** — the frozen draft. Changing the copy after approval invalidates the grant (FB-044's
  attestation pins the proposal blob, so a post-grant swap is already rejected).
- **channel**, **sending identity + OAuth scope**
- on grant: **approver + timestamp**, from the `approval.granted` event's actor and `at`

### Suppression is its own log

`suppression.added` / `suppression.removed`, projected to the current list. Removal exists because
someone who re-consents must be able to hear from the venture again — but the *record* of their
objection is never deleted, only superseded. That difference is the whole point of an audit log.

## Migration: bridged, not retired

FB-044's files still exist, and the deployed executor still writes them. So the ticket's "retired
**or bridged**" resolves to bridged: `activegraph-bridge.ts` derives the equivalent event chain from
the three files, and everything downstream sees one model.

**A bridged record is marked `bridged: true`, and is weaker evidence:**

- Order and causation are **reconstructed, not recorded** — the files carry no sequence.
- Timestamps may be missing; v0 did not require them.
- The granting actor comes from `grant.json.approver`, which the HMAC attestation binds — the one
  part of v0 that was cryptographically real.
- The proposer is attributed to a **lane**, never a human. Attributing a v0 proposal to a person is
  the one lie that would matter: it would make an ungranted action look approved.

A native log is preferred **only when it is a complete chain** (opens with `approval.proposed`). A
log that opens mid-story is the signature of a partial migration, and the v0 files are then the more
complete record — preferring the truncated log would lose history rather than gain provenance.

## Write ordering, and what fails safe

The studio's Approve writes `grant.json` **first**, then appends `approval.granted`.

That order is deliberate. `grant.json` is what the deployed executor verifies, so it must land first:
an event written before a failed grant write would claim an approval that can never execute. The
reverse — a grant with a missing event — is a gap the bridge fills from the file, with the
attestation still binding the approver. **A failed append costs record fidelity, never correctness**,
and the founder is never told their approval failed when it did not.

The executor appends `approval.executing` / `executed` / `rejected` on the same terms:
`execution.json` remains the authority for control flow (it is what makes the run idempotent); the
events are the record.

## Still to do

- **Retire the v0 files** once every venture's approvals are natively event-sourced. Until then the
  bridge is load-bearing and both paths are written.
- **Wire suppression events into the send path** — the projection and its log format are here, but
  nothing writes `suppression.added` yet, because nothing sends yet (Phase 4b).
- **Replay/fork as an operator tool.** `replayTo` exists and is tested; there is no UI for walking an
  approval's history.
