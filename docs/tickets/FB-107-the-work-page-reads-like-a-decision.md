# FB-107 — The work page reads like a decision

**Status:** Todo · **Phase:** 3 · **Asked for by:** John, 2026-08-04, walking a real review — the
full quote is the spec: sections confusing, no GitHub link here (yet the drawer over-links to it),
no way to launch the product and see the change, "team" unexplained, "Worth knowing" thin, the
record hard to follow, "Something your venture knows" appearing under "What changed" without
introduction, and "The Description of the Work" — the founder's own ask — at the bottom. ·
**Repo:** fountainbridge · **Branch:** `fb-107-the-work-page-reads-like-a-decision` ·
One ticket = one branch = one PR.

## The reframe

The work page grew bottom-up from what the machinery could show (FB-064 → FB-081 → FB-071). John
read it top-down as a person making a decision, and the order is inverted for him. A decision page
answers, in order: *what did I ask for → what did they do → what does it look like → am I OK with
it?* Today the ask is at the bottom, the doing is quoted engineer-voice at the top, the looking
doesn't exist, and the OK button sits among things it doesn't explain.

## What ships — the page, reordered around the decision

1. **What you asked for** — the originating ticket (id + title + its "why"), first. This is also
   FB-098's done-vs-intended requirement landing on its natural page.
2. **What your team did** — the summary, in team voice, stripped of machinery (the Claude Code
   footer dies here; FB-100 overlaps and this page is where it shows).
3. **See it** — the surface's launch button (FB-093's target) right on the page: review, click,
   look at the product. Where the work includes UI screenshots in its evidence, show them —
   evidence the lane already sometimes produces; render it when present, never fake it when not.
4. **The changes** — the file-level detail, rendered as today but AFTER the human summary, with a
   quiet "view on GitHub" reference link (the drawer's over-linking and this page's under-linking
   meet in the middle: reference everywhere, requirement nowhere).
5. **The decision** — Accept, or send back with a note. The note goes where the team will read it
   (the ticket's thread), closing the loop FB-105 opens from the drawer side.
6. **The record** — the full provenance trail, last, collapsed, for the day it matters.

"Something your venture knows" (a knowledge deposit riding in the same change) gets introduced for
what it is: *"This work also added to what your venture knows:"* — one line before the entry, or
it moves under Knowledge (FB-106) entirely.

## Explicitly NOT here

- The queue page itself (FB-099/FB-100 cover its naming and badges).
- Generating screenshots the work didn't produce (the lane's own evidence or nothing — honesty
  over decoration).

## Acceptance criteria

- [ ] The page reads ask → did → see → decide → record, in that order.
- [ ] The launch button appears on every work page whose surface has a target.
- [ ] "Send back with a note" exists and lands where the team reads it.
- [ ] No machinery voice: footer stripped, "team" introduced, record collapsed by default.
- [ ] E2e drives a full review through the new order, including a send-back.
