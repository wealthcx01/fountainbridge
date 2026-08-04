# FB-107 — The work page reads like a decision

**Status:** Done · **Phase:** 3 · **Asked for by:** John, 2026-08-04, walking a real review — the
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

## Verified in the browser (audit of 2026-08-04, post-review)

Driven as the founder on `work/arca/36`. Confirmed: the ask sits at the bottom and renders as raw
markdown (`**Status:**`, `- [x]`, `##` all literal); the title is branch-speak ("build:
show-set-name-card-pages (Foundry lane)"); no launch link and no GitHub reference on the page.
One NEW dead end this audit found: the page says *"This work clashes with something else that
changed since it was written… The team needs to bring it up to date before it can be accepted"* —
correct and honest, but there is **no control to ask the team to do that**. A decision page that
names the required action must offer it; the send-back-with-a-note affordance covers this case
("please bring this up to date" is a one-click note).

## Explicitly NOT here

- The queue page itself (FB-099/FB-100 cover its naming and badges).
- Generating screenshots the work didn't produce (the lane's own evidence or nothing — honesty
  over decoration).

## Acceptance criteria

- [x] The page reads ask → did → see → decide → record, in that order. — asserted by bounding-box
      order in `e2e/work.spec.ts`, so a future edit that re-inverts it fails CI rather than a review.
- [x] The launch button appears on every work page whose surface has a target. — the surface is the
      one whose repo the work is in; the target is the manifest's `launch:` (FB-093), which the board
      already had and the page a founder decides on did not.
- [x] "Send back with a note" exists and lands where the team reads it. — `sendBackWork` posts to the
      work's own thread, attributed to the signed-in founder. Nothing is merged, closed or changed:
      this is the founder talking, not the studio acting.
- [x] No machinery voice: footer stripped, "team" introduced, record collapsed by default.
- [x] E2e drives a full review through the new order, including a send-back. — plus a gallery
      screenshot (`18-work-decision.png`): the page a founder actually decides on had no picture in
      the UI gate, which is how it came to be reviewed by reading code instead of by looking at it.

## What shipped

The order, and the two things the order needed to exist: the **ask** (`WorkItem.ask` — the ticket read
whole from the work's own head commit, rendered as markdown, its duplicate title heading dropped) and
the **way out that was not "accept"** (`sendBackWork`). Plus the launch door, the quiet reference link
to the code host, the knowledge-deposit introduction, and `stripMachinery` — one owner for taking the
tool's signature off anything a founder reads, applied to the summary and the record together so they
cannot disagree about what the team wrote.

The page heading is now the ask's title. John met his own product's work headed *"build:
show-set-name-card-pages (Foundry lane)"*.

## Two earlier rules this amends, deliberately

- **FB-064: "nothing on the work page sends the founder to a code host."** Right when the queue's
  only affordance was a link to github.com; wrong once the studio renders the work itself. The
  amended rule is the one this ticket asked for — reference everywhere, requirement nowhere — and
  the e2e now pins it: exactly one such link, not a button, below the summary.
- **FB-081: "the decision comes before the detail."** It was protecting a founder from meeting the
  button under 13,856 characters of gate transcript. The transcript now sits BELOW the decision
  (§6, collapsed), and what sits above it is a bounded file list of one line each. The test is
  re-expressed to assert what FB-081 was actually protecting: the decision never sits under the
  record.

## Also found while building it

The changes list rendered the ticket file's *diff* as plain text, which is where `# ARCA-44 —` and
`**Status:**` reached the founder as literal characters. With the ask rendered whole above, that
entry now points at it instead of repeating a fragment of it.
