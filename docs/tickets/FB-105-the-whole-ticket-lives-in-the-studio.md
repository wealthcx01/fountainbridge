# FB-105 — The whole ticket lives in the studio

**Status:** Todo · **Phase:** 3 · **Asked for by:** John, 2026-08-04 — *"to see all the detail, it
takes you out to GitHub… why cant we have this in the studio all as one ticket? And for example,
some ticket's 'need my okay' but there is then no button to click accept, or deny, or then use the
composer to edit the tickets."* · **Repo:** fountainbridge ·
**Branch:** `fb-105-the-whole-ticket-lives-in-the-studio` · One ticket = one branch = one PR.

## The seam

The studio's promise is a view + write-path over git so the founder never has to BE a git user.
The ticket drawer breaks that promise at exactly the moment of interest: it shows why-this-matters,
scope, and criteria, then hands the founder a GitHub link for "all the detail" — a different
product, a different design, and a page written for engineers. Worse, a ticket sitting in "Needs
your OK" renders in the drawer with **no way to give the OK** — the decision lives on a different
page (the work view) with no visible thread between the two. The founder is shown a decision and
denied the lever.

## What ships

**1. The full ticket, rendered here.** The drawer shows the complete ticket body — every section,
formatted (the parser already holds the whole markdown; the drawer chooses to truncate). GitHub
remains as a small "view the raw file" reference link for the curious, never the continuation of
reading.

**2. The decision where the ticket is.** When a ticket's work is waiting on the founder, the
drawer carries the same Accept action (and the same "send back with a note" once FB-107 lands
review-notes) as the work page — one decision, two doors, one implementation (the existing FB-064
server action, reused not duplicated).

**3. Edit through the composer.** An "Ask for changes to this ticket" affordance that opens the
in-studio composer pre-seeded with the ticket's id and body, so "make the scope smaller" is a
sentence, not a git edit. The composer files the edit through its existing ticket tool — the write
path stays the one that already exists and is already gated.

**4. One identity everywhere.** The drawer, the queue card, and the work page for the same piece
of work show the same id + title (depends on FB-099's matcher), so a founder always knows they are
looking at the same thing.

## Explicitly NOT here

- In-place text editing of ticket files in the studio (the composer IS the edit surface; a second,
  ungated write path is how drift starts).
- The work page's own redesign (FB-107).

## Acceptance criteria

- [ ] A founder reads a full ticket, decides on it, and requests changes to it without leaving
      the studio.
- [ ] The GitHub link is a reference, not required reading — nothing on it is absent here.
- [ ] Accept in the drawer and Accept on the work page are the same server action.
- [ ] The composer opens pre-seeded from a ticket and files an edit to that ticket.
