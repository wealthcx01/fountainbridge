# FB-207 — decided work leaves the desk, and What happened proves it was signed

**Status:** filed · **Phase:** 3 · **Raised by:** Claude Design, 2026-09-08 (R-01 + R-11) ·
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

- [ ] A decided send appears on What happened with its provenance stated in words, and a link to its
      approval page.
- [ ] A **forged** grant on a past send is visible on What happened and says it did not verify.
- [ ] A failed or unverified send is a row in Waiting on you, in amber, above the ordinary work.
- [ ] Neither `approvals-decided` nor `approvals-attention` renders on the desk.
- [ ] The three FB-046 tests that guard "a founder approved something and the card vanished" pass
      against their new home rather than being deleted with the old one.
