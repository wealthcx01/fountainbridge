# FB-071 — The full ActiveGraph record, on ground the audited party cannot write

**Status:** Planned · **Phase:** 4 · **Depends on:** FB-051 (what shipped and why the rest did not),
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

## Acceptance criteria
- [ ] The event log lives somewhere no lane holds a credential for, and a test proves a lane-held
      token is refused.
- [ ] Every grant and every execution writes an event, from the component that already holds the
      credential.
- [ ] The projection reconstructs the full story in order, attributed, and replays deterministically.
- [ ] A forged or lane-authored event cannot reach `granted` — proven by a test that tries it.
- [ ] The founder sees a readable history, not an event dump.
- [ ] What the record still cannot prove is written down where a reader will find it.

## Verification
`/review` + CI, with an adversarial pass whose brief is a single question: *what could a lane write
that this believes?* Plus the FB-051 discipline — a mutation run over the projection, because the
last version of this shipped code whose faults only showed when someone tried to break it.
