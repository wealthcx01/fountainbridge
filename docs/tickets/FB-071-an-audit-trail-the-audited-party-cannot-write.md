# FB-071 — The full ActiveGraph record, on ground the audited party cannot write

**Status:** Done · **Phase:** 4 · **Depends on:** FB-051 (what shipped and why the rest did not),
FB-044 (the executor) · **Repo:** fountainbridge · **Branch:**
`fb-071-an-audit-trail-the-audited-party-cannot-write` · One ticket = one branch = one PR.

## Why this matters (for the founder)
When the studio says a person approved something, you should be able to see the whole story — who
asked, who agreed, what happened next, in order — and know that story could not have been written by
the thing being audited.

## The question this answers
"Having all of ActiveGraph wouldn't hurt, right?"

**It would hurt, if we rebuilt it the way it was.** And it would help a great deal if we move it.

## Why the first attempt was withdrawn
FB-051 set out to build the event-sourced runtime and pulled it back mid-ticket. Not because it was
hard, but because it could not be true.

The event log lived on the `foundry-approvals` ref in the **venture's own repository** — a ref the
proposing lane holds write access to. So a lane could write `approval.granted` with
`actor.kind: 'founder'`, and the projection would report a grant, by a named human, with no fault
raised. The design document claimed "a forged grant cannot even project to granted". That claim was
false, and the review that found it was right to kill the feature rather than guard it.

**An audit trail the audited party can write is worse than no audit trail**, because it manufactures
confidence instead of merely lacking it. That is the same failure as the composer saying it filed a
ticket it had not filed (FB-062), on the one surface where it matters most.

What shipped instead was narrow and true: the studio verifies the HMAC attestation — the one thing a
lane genuinely cannot forge, because the secret lives on the studio and the executor and never on a
lane box — and says plainly when it cannot verify something.

## What changes here
Move the record to ground the lane cannot write, and the original design becomes buildable.

The lane holds a repo-write token for the venture. It does **not** hold the studio's write credential
(`STUDIO_APPROVAL_GITHUB_TOKEN`) or the signing secret. So a log written only by the **studio** and
the **executor** — the two parties that hold those — is a log the audited party cannot author.

## Scope
- **Move the event log off the venture ref.** Options to weigh in the ticket rather than assume: a
  ref in the studio's own repository, a Supabase table the lane has no credential for, or an
  append-only store keyed to the approval secret. The test for each is one question: *can a lane
  write to this?* If yes, it is not an audit trail.
- **Write the events at the two moments that already exist**: the studio issuing a grant (FB-046),
  and the executor recording what it did (FB-044). Both already hold the credentials; neither
  currently writes history.
- **Rebuild the projection** — proposed → granted → executing → executed/failed — now that it can
  enforce something, with the human-only-grants rule expressed by the projection as well as by the
  HMAC. Defence in depth, but this time both layers are real.
- **Actor attribution and lineage**, which was the point of the original ticket: who asked, who
  agreed, what followed, in order, replayable.
- **Surface it to the founder** as a plain-language history on the approval, not as an event dump.

## Out of scope
- Retiring the file-based records on the venture ref. They are what the deployed executor reads;
  changing that is a migration with a live component and belongs in its own ticket.
- Adopting the upstream ActiveGraph project itself. It is Python, and a service plus datastore per
  venture runs against D1/D2 and the TypeScript stack — FB-051 already made that call. This applies
  the *model*: append-only log as truth, state as projection.

## The honest caveat
Even after this, one thing stays outside the record: the **execution outcome** is written by the
executor, and if the executor is ever compromised the log follows it. That is a smaller surface than
today — one component we control and deploy, rather than every lane on every venture box — but it is
not zero, and the ticket should say so rather than claim a guarantee it cannot keep.

## Where it went, and the premise that turned out to be false
The plan was: move the log to the studio's own repository, which the lane has no credential for.

So the premise was checked rather than assumed, and it was wrong. The lane's token on the ARCA box
has **admin on `wealthcx01/fountainbridge`** — it is scoped to the whole org, not to the venture. No
GitHub location satisfies "somewhere no lane holds a credential for" while that is true. Written up
as **FB-072**, with the exact remediation; it needs a PAT only John can mint.

Two things were checked in the same pass and are sound:

- **The lane does not hold `FOUNDRY_APPROVAL_SECRET`** — it appears in no file under `/opt` or `/etc`
  on the box. The signing gate holds.
- **`main` is branch-protected**, so a lane cannot push to the studio's default branch.

So the record ships with **two real layers instead of three**, and the missing one named rather than
implied:

1. **Every event is signed** with the studio↔executor secret. An unsigned or wrongly-signed event is
   not a suspicious event — it is not an event, and the projection never sees it. This is what makes
   the record sound today.
2. **The projection refuses a grant no human issued**, independently of the signature — so even a
   leaked secret would have to defeat a rule that exists in a second place.
3. ~~The log lives where no lane holds a credential~~ — **FB-072**. A lane can append bytes to the
   ref. It cannot make them count.

## Acceptance criteria
- [~] The event log lives somewhere no lane holds a credential for — **not yet, and FB-072 is why.**
      It lives on a `foundry-activegraph` ref in the studio's repository, which is the right place;
      the lane's org-wide token is what stops that being sufficient. A test proves the thing that
      *does* hold: an event signed with anything other than the studio's secret is refused before the
      projection sees it.
- [x] Every grant and every execution writes an event, from the component that already holds the
      credential — the studio on approve (`approval.proposed` + `approval.granted`), the executor on
      outcome (`action.executing` / `executed` / `failed`).
- [x] The projection reconstructs the full story in order, attributed, and replays deterministically.
      Ordering is by sequence number, never by clock, so the studio and the executor writing from two
      machines with disagreeing clocks still replay to one history.
- [x] A forged or lane-authored event cannot reach `granted` — proven three ways: a wrong signature is
      discarded on read; a genuine signature lifted onto a changed event fails; and a perfectly-signed
      grant from a non-human actor is refused by the projection itself.
- [x] The founder sees a readable history, not an event dump — "Your team asked for your OK: …",
      "john@bruntsfield.capital approved it.", "It was done."
- [x] What the record still cannot prove is written down where a reader will find it — at the top of
      `lib/activegraph.ts`, in this ticket, and in FB-072.

## Proven against real GitHub
The code is right and the record is sound. **It is not yet writing in production**, and the reason is
a credential, not the design.

Four events were written to the real `foundry-activegraph` ref on `wealthcx01/fountainbridge` and read
back through the studio's own `historyFor`:

| # | What was written | What the studio did |
| --- | --- | --- |
| 1 | `approval.proposed`, signed with the real secret | applied |
| 2 | `approval.granted` by a human, signed with the real secret | applied — approver named |
| 3 | `approval.granted` by a human, signed with **a secret a lane made up** | **refused on read** — never reached the projection |
| 4 | `approval.granted` by an **agent**, correctly signed with the real secret | **refused by the projection** — the second layer, doing its job |

```
status  : granted
approver: john@bruntsfield.capital
refused : 1 (signature did not hold)
  - Your team asked for your OK: a live proof of the record.
  - john@bruntsfield.capital approved it.
  ! Something was recorded here that the studio would not accept (an agent cannot grant —
    only a person can agree to this). It has been ignored, and it did not change anything.
```

Both attacks failed, in the two different ways they were meant to.

### The one thing blocking it in production
`STUDIO_APPROVAL_GITHUB_TOKEN` is scoped to the venture repos and **cannot write to
`wealthcx01/fountainbridge` at all** — a `PUT` to its contents returns 403. That is good
least-privilege for everything else the studio does, and it is why the live proof above was run with a
credential that can write.

Until the token can reach the record's repository, the studio takes the honest path rather than a
convenient one: the approval still happens (the grant is written and the executor verifies it), and
the founder is told *"the studio could not write it to the history"* rather than being shown a clean
record that does not exist. **It does not fall back to the venture's own ref** — that ref is the one
the lane can write, and putting the record there is exactly what made the first version worthless.

What John needs to do — two minutes, and it is his PAT:

> github.com → Settings → Developer settings → Fine-grained tokens → the studio's approval token →
> **Repository access**: add `fountainbridge` → **Contents: Read and write**. Nothing else changes.

Then one approval through the studio writes its first two events, and the history appears on the card.

## What the record still cannot prove
The execution outcome is written by the executor. If the executor is ever compromised, the record
follows it. That is a much smaller surface than before — one component we build and deploy, rather
than every lane on every venture box — but it is not zero.

The executor is also the one component holding both the signing secret and a write credential, so it
is the only place a validly-signed forgery could originate. It cannot forge the part that matters:
`eventsForExecution` has no path from any execution record to `approval.granted`, and the projection
refuses a grant from a non-human actor regardless. A compromised executor can lie about what it did.
It cannot invent a person agreeing.

## Verification
41 unit tests across three files:

- **The projection** — the full story replayed; the same history whatever order events arrive in; a
  lane's grant refused; the *executor's* grant refused too; an execution with no grant in front of it
  refused; an approval that begins already granted refused; a second event written over an existing
  position refused; un-rejecting refused; re-running after done refused; and every refusal surfaced
  rather than dropped.
- **The signature** — a real signature accepted; any other secret refused; no signature refused; an
  unconfigured studio refusing everything rather than accepting everything; a genuine signature
  lifted onto a changed event refused; a real event replayed into another venture refused; and the
  end-to-end version — a lane appends a perfectly-shaped `approval.granted` naming a real human, and
  it never reaches the projection.
- **The two runtimes** — the studio signs in TypeScript, the executor in plain ESM on the box. Both
  are pinned to one canonical vector, because a drift there would not fail loudly: it would make
  every real event the executor writes read as forged, and show the founder a warning on every
  genuine send.
