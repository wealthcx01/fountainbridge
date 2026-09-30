# FB-234 — Sell: a CRM the agents can actually use

**Status:** filed · **Phase:** 4 · **Raised by:** John, 2026-09-25 · **Blocks:** FB-235 ·
One ticket = one branch = one PR.

## Why this one fits when most CRMs would not

`dzhng/crm.cli` (MIT) describes itself as *"an open-source, headless CRM built for agents. No UI. No
dashboard. Just a CLI and a FUSE-mounted filesystem."*

**Files and a command line is our spine.** Non-negotiable 1 says git is the record and the studio is a view
over it. Every CRM with a dashboard would be a second store of record, competing with git and winning by
accident. This one is contacts and deals as **files**, which the venture repo already knows how to hold and
gbrain already knows how to read.

"Built for agents" is also the right posture. The Sell lane does not need a screen to click; it needs to
read who we are talking to and write what happened.

## What a founder should get

On the Sell surface: **who we are talking to, what stage each conversation is at, what was said last, and
what is waiting on them.** Read on the desk, written by the lane, and every outgoing message still gated.

## What to check before committing to it

Named here so they are decisions rather than surprises:

- **The FUSE mount.** It needs a kernel feature on the venture's machine. It has to be confirmed to work
  there, and confirmed not to break the machine if it stops. **A CRM that vanishes when a mount drops is
  worse than a text file.**
- **Where the files live.** In the venture repo means git holds the record, which is right, and means
  contact details are in a repository — and `arca` is **public**. That is a real problem and it decides the
  answer: either the repo is private, or the CRM data lives somewhere else with pointers in git (the D8
  pattern for heavy or sensitive files).
- **Who may read it.** Venture isolation is absolute (non-negotiable 6). One venture's pipeline must be
  unreachable from another, proved by a test that tries and fails.

## Scope

1. Read `crm.cli` end to end. It is small enough to read fully, so read it rather than trusting the README.
2. Settle the three questions above **before** any install, and write the answers into the ticket.
3. Stand it up for one venture with real contacts, not fixtures.
4. Surface it on the Sell surface as a read model, through the same seams every other read uses.

## Out of scope

- Sending anything. Every outgoing message stays behind the approval gate.
- The pipeline view and its stages. That is FB-235, and it needs this first.
- Replacing anything the lane already writes. If this duplicates a fact the lane already records, the
  duplicate is the bug.

## Acceptance criteria

- [ ] The three questions above are answered in writing before anything is installed.
- [ ] Contact details are not in a public repository. Whichever answer is chosen is stated and enforced.
- [ ] A test proves one venture cannot read another's pipeline, at the boundary rather than in the UI.
- [ ] The Sell surface shows the pipeline from the real store, with no second copy of any fact.
- [ ] Nothing in it can send. Proved by trying.
- [ ] If the mount is unavailable, the surface says so plainly and the rest of the studio is unaffected.

## Verification

The Sell surface is a screen, so non-negotiable 11 applies: rendered at 1440×1000 and 393×851 against the
design, both looked at, heights recorded.
