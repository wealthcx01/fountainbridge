# FB-051 — Full ActiveGraph runtime for external actions (fully apply ActiveGraph)

**Status:** In progress · **Phase:** 4b · **Depends on:** FB-044 (git-backed gate + executor), FB-046
(in-studio approve) · **Repo:** fountainbridge (+ ActiveGraph) · **Branch:** `fb-051-full-activegraph-runtime`
One ticket = one branch = one PR.

## Why this matters (for the founder)
When the studio says an outside action was approved by a person, that is checkable — not a claim
sitting in a file anyone with repo access could have written. And when it *cannot* check, it says so
plainly and tells you what to do about it.

## Context
FB-044 shipped a git-backed gate: proposal / grant / execution as files on a `foundry-approvals` ref,
with an HMAC attestation the executor verifies. `docs/research-gtm.md` §5 asked for an event-sourced
ActiveGraph runtime on top — an append-only log as the audit record, with the human gate enforced by
the projection.

**That was attempted and withdrawn.** The log lives on a ref the proposing lane holds repo-write on,
so a projection over it can enforce nothing: a lane writing an `approval.granted` event with
`actor.kind: 'founder'` projected to granted, by a named human, with no fault raised. Exactly one
thing here is unforgeable — the attestation — because its secret lives on the studio and the executor
and never on a lane box. So the ticket became: verify that, and be honest about everything else.

## Scope
- **Verify the attestation in the studio's read path** (`lib/provenance.ts`), reporting
  `attested` / `unattested` / `none`. An unattested grant is never shown as an approval.
- **Bind the venture into the signed message.** One secret serves every venture and a git blob sha is
  content-addressed, so `id|proposal_sha|approver` alone could be replayed from another repo.
- **Read every founder-visible field from the sha-pinned proposal**, so what a founder approves and
  what the executor performs are the same artefact.
- **Write a real `failed` status**, and render terminal states, so an errored send is loud.
- **Say what to do next** for each way verification can fail — a changed proposal is a re-approve, a
  bad signature is an incident.

## Out of scope
- The send transport (Phase 4b). The engineering PR gate (stays git/CI).

### Originally scoped, withdrawn
Emitting `approval.proposed`/`granted`/`executed` events; the append-only log as the audit record;
the attention queue rendering from the event stream. `lib/activegraph.ts`,
`lib/activegraph-bridge.ts` and `docs/activegraph-runtime.md` are deleted.

## Acceptance criteria

**Narrowed, on John's call (2026-07-31), after a ten-specialist review.** The ticket asked for an
event-sourced runtime whose projection enforces the human gate. That cannot be built on this
substrate, because the log lives on a ref the proposing lane can write — so the projection could
enforce nothing, and the design doc's claim that "a forged grant cannot even project to `granted`"
was false. What ships instead verifies the one thing that IS unforgeable and is honest about the rest.

- [x] **The studio verifies what it can prove.** `lib/provenance.ts` recomputes FB-044's HMAC
      attestation over `repo|id|proposal_sha|approver` — the studio issues those and holds the secret,
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
| The executor's event append | The surviving half of the same log — write-only, on a lane-writable ref, justified by a comment about a bridge this branch deleted |

**The event log is gone entirely** — from the studio and from the executor. Keeping a write-only log
on the ref the audited party can rewrite was the artefact this narrowing exists to remove.

## Still open
- ⚠ **The execution record remains lane-authored.** The attestation now covers
  `repo|id|proposal_sha|approver`, so a grant cannot be forged or replayed across ventures — but the
  outcome is not signed. A lane can still write `execution.json {status:'rejected'}` over its own
  grant, or DELETE it to make the executor re-run a genuinely approved send. The studio now reports
  an execution with no verifiable grant as `unverified-action` rather than as a clean outcome, which
  makes deletion visible; it does not make it impossible. **Signing the execution record, and giving
  the executor an idempotency ledger outside the lane-writable ref, is the next real step** — and
  FB-054's reported spend depends on the same change.
- ❌ **The approve click is not bound to the proposal the founder saw.** `proposalSha` is computed
  and unused; the server action re-reads and signs whatever is current, so a pre-grant swap is
  unguarded. Verification catches it afterwards (the sha stops matching) but does not prevent it.
- ❌ **No component or e2e coverage of the approval card.** The provenance render — the only place
  the warning reaches a human — is deletable without failing a test: there is no approvals fixture
  and `app/` is outside the vitest glob. Wiring `APPROVALS_FIXTURE_DIR` the way tickets/PRs/health
  are wired is the fix; `fixtureApprovalSource` already exists and has no caller.
- ❌ **The approve server action is untested**, including its D7 denial: `app/` is outside the vitest
  include, so a test placed there would silently never run.

## Verification
32 unit tests over provenance, the approval read path and the executor, written against a mutation
pass that ran 32 mutations and found 10 surviving. Now pinned: a truncated or extended signature
(a prefix comparison verified `attestation:'a'` roughly one time in sixteen); the verifier's own
case/whitespace normalisation (a grant the studio issued for a mixed-case address read as forged);
cross-venture replay; a lane-written `summary` in `grant.json` being ignored in favour of the pinned
proposal, proved with an adversarial fixture rather than an absent one; a throwing action recorded as
`failed` and never `executed`; and the missing-secret case, which previously read `process.env` and
would have gone red the moment `FOUNDRY_APPROVAL_SECRET` was set.

160 tests, lint, typecheck, build, UI gate (34), ticket parse, manifest validation, shellcheck.

**Not yet run on ARCA's box.** The verification path needs `FOUNDRY_APPROVAL_SECRET` set on the
studio — the same value the executor holds. Until it is, every grant reads `unattested`, which is the
correct failure direction but means the founder sees a warning on real approvals.
