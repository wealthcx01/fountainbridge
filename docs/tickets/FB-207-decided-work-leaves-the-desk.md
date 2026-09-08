# FB-207 — decided work leaves the desk, and What happened proves it was signed

**Status:** Done · **Phase:** 3 · **Raised by:** Claude Design, 2026-09-08 (R-01 + R-11) ·
**Branch:** `fb-207-decided-work-leaves-the-desk` · One ticket = one branch = one PR.

**First, and with its other half.** The reviewer's own ordering: *"R-01 with R-11 first (they unblock
each other), then Tickets (R-04–R-08), then R-02 across every screen, then Memory."*

## What was found

> **R-01 — Move decided approvals off the desk.** Two ApprovalCard sections remain below Waiting on
> you. The desk is forward-looking; a granted or executed send is a record.
>
> **R-11 — Attestation on decision rows.** Decisions read as prose; nothing on the row says whether
> the signature verified. **This is what kept R-01 on the desk.**

The second sentence is the whole ticket. The desk's own code says so, in a comment written when the
instruction to move these sections first arrived:

> *"It is not only a record. It is the only place a founder can see whether a COMPLETED approval's
> signature was genuine … Removing this section would make a forged grant on a past send invisible,
> which is non-negotiable 4 — a recorded, VERIFIABLE human approval — failing quietly."*

That was right, and it is why the sections are still there. The answer is not to keep them; it is to
give What happened the attestation first. Then the desk can lose them without losing anything.

## Why it matters

A desk that carries finished business is a desk a founder scrolls. But a screen that shows a decision
without saying whether its signature checked out is worse than one that does not show it at all —
FB-046 exists because a lane could write a grant file, and the studio's answer is that it can tell a
real one from a forged one and says which.

Three tests went red the last time this was attempted, and their own comment says why they exist:
*"`granted` rendered NOWHERE. A founder clicked Approve on something irreversible and the card
vanished."*

## Scope, in this order

1. **What happened carries the attestation.** Every decision row: a square in its tone, the sentence,
   then *"signature verified"* in mute — or the amber clause when it did not — linking to that send's
   approval page. `lib/activity-feed.ts` builds the row; `components/ActivityFeed.tsx` renders it.
2. **Then, and only then, delete both desk sections.** `approvals-decided` and `approvals-attention`
   come out of `components/VentureBoard.tsx`.
3. **Failed and unverified sends do not disappear — they move up.** They are amber rows in
   **Waiting on you**, because they need the founder, and the design's rule is one queue.
   `components/WaitingQueue.tsx` already carries the unverified alarm; this widens what reaches it.

## Out of scope

Changing what makes a grant trustworthy. The HMAC signature and `lib/approvals.ts`'s provenance
verdicts are unchanged — this ticket moves where the verdict is *shown*, not how it is reached.

## Acceptance criteria

- [x] A decided send appears on What happened with its provenance stated in words, and a link to its
      approval page. — *"john.gallagher@wealthcx.com approved: … · signature verified →"*.
- [x] A **forged** grant on a past send is visible on What happened and says it did not verify.
- [x] A failed or unverified send is a row in Waiting on you, in amber, above the ordinary work.
- [x] Neither `approvals-decided` nor `approvals-attention` renders on the desk.
- [x] The FB-046 tests that guard "a founder approved something and the card vanished" moved to the
      new home rather than being deleted with the old section.

## Done, 2026-09-08

**The order was the whole ticket, and it held.** What happened carries the attestation first; the desk
lost the sections second. Nothing about a completed approval is less visible than it was — it is on
the screen whose job is the record rather than the one whose job is what happens next.

### The fixture that never existed

Writing the test for *"a forged grant on a past send is visible"* found that **no fixture could
produce one.** `forged-grant` and `changed-proposal` are adversarial grants with no execution record,
so `statusOf` correctly calls them `proposed` — they are queue items, not history, and they never
reach What happened at all.

Which means the studio has never had a test for the case the whole attestation story exists for: **a
grant the studio did not issue, which the executor then acted on.** `executed-forgery` is that
fixture. It is the row now pinned to the top of What happened.

### And a bug that fixture exposed

`unverified-action` built its feed entry from `committedAt` alone. An undated entry is dropped from
this feed on purpose — so a forgery with no execution timestamp was **dropped**, and the one row
marked `pinned: true` precisely so it can never be sorted off the page was never reaching the page.
It uses the grant's own time now, falling back to the execution's.

### One read the desk no longer makes

`loadApprovalHistories` fanned out across every approval on the venture — one of the desk's costlier
reads — and its only consumer was the two sections. The approval's own page still loads the history
for the one approval a founder opened, which was always the right shape. Fetching a venture's whole
ActiveGraph record to render a page that shows none of it is the cost FB-164 went looking for.

### Read

1440×1000 and 393×851 on fixtures: the desk **2,282px** and **2,695px**, What happened **1,036px**,
no sideways scroll anywhere. Both desk numbers are *up* about 60px, and the reason is the new fixture
adding a row to the queue — on production, which has no forged send, the two deleted sections come
off with nothing replacing them.

**Looking also caught the clause landing after the arrow**: the row read *"…nobody at the studio
issued → · signature not verified"*, the arrow ending the sentence and then more sentence after it.
The clause is inside the link now, before the arrow — and it is the best reason to press the row, so
it belongs in the target rather than beside it.
