# FB-081 — The work page is the team's notes, not a decision

**Status:** Todo · **Phase:** 3 · **Depends on:** FB-064 (read and accept work in the studio) ·
**Repo:** fountainbridge ·
**Branch:** `fb-081-the-work-page-is-the-teams-notes-not-a-decision` · One ticket = one branch = one PR.

## Why this matters (for the founder)
FB-064 gave founders a page where they can read a piece of work and accept it without going to
github.com. That was the right move and it works.

But the page is now **13,856 characters** — the great majority of it the lane's own working notes,
written by an engineer's tooling for an engineer's eye. The founder's actual job on this page is one
decision: yes or not yet. That decision is buried under four thousand words of evidence.

A page that makes a person scroll through a technical document to find a button teaches them to stop
reading and just press the button. Which is exactly the rubber-stamping the ticket set out to avoid.

## What was found
Walked on 2026-08-01, from the attention queue into `ARCA-43: commission a UI/UX audit of the
terminal`. Measured:

- **13,856 characters** on the page.
- Most of it inside *"What the team says about it"* — the pull request body.
- For lane-built work that body is the gate evidence: every validation gate with its result, the
  `/review` verdict, the `/qa` findings, the PRP summary. Written as a list of gate names and outcomes.

The irony is that FB-064 added that section *deliberately*, and for a good reason: when the change is
code a founder cannot read, the evidence that it was checked is the thing they are actually judging.
That reasoning still holds. What is wrong is the **form**: the entire body is dumped in, unedited,
including the parts written for the machine that produced it.

Two further things noticed on the same page.

**The word "CI" appears.** The page otherwise speaks plainly — *"a small change to the app's code
(seed.ts) — 19 lines added, 1 removed"* — and then leaks one acronym. FB-064's own labels avoid it;
this comes through from the pull request body, which nothing rewrites.

**Nothing says how long this has been waiting or what happens if it keeps waiting.** The queue says
"17h old". The work page says nothing about time at all. A founder deciding whether to read this now
or later has no information to decide with.

## What the page should be
An answer to one question — *should this become part of my product?* — in this order:

1. **What it is**, in a sentence. Already there.
2. **What changed**, described. Already there and good.
3. **Whether it was checked**, in a line: what was run, what passed, what a human reviewed. Not the
   full transcript — a verdict, with the transcript available.
4. **What is unusual about it**, if anything: a gate that failed and was re-run, a caveat the lane
   recorded, a manual verification standing in for an automated one. This is the part a founder
   genuinely needs and it is currently indistinguishable from the routine.
5. **The decision.**

The full body should still be reachable — it is the honest record and it is what a reviewer would
want — but behind a control, not in front of the button.

## Scope
- **Summarise the gate evidence into a verdict line plus exceptions.** The lane already produces
  structured output; FB-060 is about giving it a defined shape, and this ticket should consume that
  shape rather than parsing prose. If FB-060 has not landed, extract what is safely extractable and
  say plainly what could not be summarised.
- **Surface the exceptions, not the routine.** "All eight gates passed" is one line. "One gate failed
  and was re-run" is the line a founder should actually see.
- **Put the full body behind "Show me everything the team recorded"**, collapsed.
- **Strip or translate machine vocabulary** that arrives through the body, including "CI".
- **Say how long it has been waiting**, in the same words the queue uses, so the two agree.

## Out of scope
- The accept mechanics, which work (FB-064).
- The structure of what the lane writes (FB-060) — this ticket reads it, that one shapes it.

## Acceptance criteria
- [ ] The decision is reachable without scrolling on a normal window.
- [ ] A founder sees whether it was checked, and anything unusual, without opening the full record.
- [ ] The full record is one press away and complete.
- [ ] No acronym reaches the page untranslated, including through the pull request body.
- [ ] The page says how long this has been waiting, agreeing with the queue.

## Verification
`/review` + CI, then the same walk on the same piece of work — `ARCA-43` — recording the character
count and a screenshot showing the accept control on the first screen. Then a piece of lane-built work
whose gates did *not* all pass first time, to confirm the exception is what stands out rather than
being one line among forty.
