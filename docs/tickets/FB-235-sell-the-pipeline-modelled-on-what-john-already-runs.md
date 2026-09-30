# FB-235 — Sell: a pipeline shaped like the one John already runs

**Status:** filed · **Phase:** 4 · **Raised by:** John, 2026-09-25 · **Depends on:** FB-234 ·
**Blocked on John** · One ticket = one branch = one PR.

## Why copy the shape of something that exists

John runs a real fundraising pipeline on Decile Hub for Bruntsfield. It works, he uses it daily, and it
already answers the questions a founder running a pipeline needs answered. **Designing our own from first
principles would be inventing a worse version of something already proven in his hands.**

So the point of this ticket is to take the **shape**: what a deal record holds, what the stages are, how an
email thread attaches to a contact, what the dashboard chooses to show first, and what it deliberately
leaves out.

## What is explicitly not being taken

**Its words and its screens.** There is a standing rule on this project, written for cofounder.co and
applying identically here: never reproduce or reword another product's copy, even as a placeholder. That is
copyright, and it is not negotiable.

We take the **information architecture**. We write our own words.

## Blocked on two things, both John's

1. **The password.** It was pasted into a chat transcript, so it is in a log. It should be changed before it
   is used anywhere, and John has said keys get rotated when the studio is complete. That is fine — **this
   ticket simply waits**, and says so rather than sitting in a queue looking workable.
2. **Approval to sign in and read it.** Reading a third-party platform with a founder's credentials is an
   external action under non-negotiable 4. It is John's own account and his own instruction, and it still
   gets recorded rather than assumed.

## Scope, once unblocked

1. Sign in, read the pipeline, and write down its shape: stages, the fields on a deal, how email threads
   attach, what the dashboard leads with.
2. Map that onto the entities we already have, through bcap-contracts (non-negotiable 7), rather than
   inventing a parallel set.
3. Build the pipeline view on the Sell surface over FB-234's store.
4. Keep every send behind the gate. A pipeline that can email is a pipeline that will email.

## Out of scope

- Any copy or visual design taken from Decile Hub.
- Email sending. The GTM research already settles how that works: interest-based only, from venture
  domains, every send an approval event.
- Replacing Decile Hub for John's own fundraising. This is the Foundry's pipeline for founders, not a
  migration of his.

## Acceptance criteria

- [ ] The shape is written down before any code, and reviewed by John, because he is the one who knows
      whether it matches what he actually uses.
- [ ] Every entity goes through bcap-contracts. No parallel type.
- [ ] Not one line of copy or one layout is taken from Decile Hub, and the ticket says so.
- [ ] Nothing can send. Proved by trying.
- [ ] A founder can answer "who is waiting on me" from the Sell surface without opening anything else.

## Verification

Non-negotiable 11 applies. And the harder verification is John's: he runs a pipeline daily, so if the shape
is wrong he will know immediately in a way no test will.
