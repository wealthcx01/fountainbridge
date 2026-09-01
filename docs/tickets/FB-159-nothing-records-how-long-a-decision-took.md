# FB-159 — Nothing records how long a decision took

**Status:** Todo · **Area:** Studio / records · **Depends on:** FB-136

## What is missing

The admin ledger's design asks for a footnote reading *"Median 9 hours from needs-you to decided,
across 31 decisions this month."* The studio cannot answer it, and FB-136 shipped a different
statistic rather than a guessed one.

**Nothing records when something started needing a founder.** An approval carries `grantedAt` (and
only when the attestation verifies); it carries no proposed-at. A pull request that has been decided
keeps no trace of how long it sat. The attention queue knows the age of what is waiting *now* and
forgets it the moment it is decided.

So the ledger says what it can measure — *"6 things waiting on founders, the middle one for 3
days"* — and says plainly that the other half is not recorded.

## Why it matters (for John)

Response time is the number that says whether a venture is founder-limited. "Waiting now" is a
snapshot: a founder who cleared everything an hour ago and a founder who has never decided anything
both read as zero. Only the decided half distinguishes a fast founder from an empty queue, and that
is the judgement the ledger exists to support.

It is also the honest half of the D7 conversation. As founders onboard and the approval matrix
routes work to different approvers, "who is slow" needs to be a measurement rather than an
impression.

## Scope

- Record the moment something starts waiting on a founder, where that moment happens: an approval
  written as `proposed`, and a pull request the studio first sees as open work.
- Record the moment it stops — decided, refused, or accepted — beside it.
- The ledger's footnote reads the real median and names its window, and the note FB-136 wrote
  ("how long a decision *took* is not recorded anywhere yet") is deleted, because it stops being
  true.

## Out of scope

- Ranking founders, or surfacing response time on a founder's own screens. Bruntsfield needs the
  number to run the portfolio; a founder does not need a stopwatch on their desk.

## Validation gates

```bash
npm run lint && npm run typecheck && npx vitest run && npx playwright test
make design-lint && make copy-lint && make ticket-drift
```

## Acceptance criteria

- [ ] A decision records when it started waiting and when it was decided.
- [ ] The ledger's footnote states a real median over a named window, from those records.
- [ ] A venture with no decided items says so, rather than reporting a median of nothing.
- [ ] The FB-136 note saying this is unrecorded is **gone**, and a test asserts it is gone rather
      than asserting the replacement is present.
