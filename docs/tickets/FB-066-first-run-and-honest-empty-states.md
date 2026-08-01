# FB-066 — Day one: one action, and empty states that say what would fill them

**Status:** Done · **Phase:** 3 · **Depends on:** FB-063 (the audit) · **Repo:** fountainbridge ·
**Branch:** `fb-066-first-run-and-honest-empty-states` · One ticket = one branch = one PR.

## Why this matters (for the founder)
Ross signs in for the first time and sees four empty boxes. Every sentence in them is well written.
Together they offer him nothing to do, which teaches him — in the first ten seconds — that the
product does nothing.

## Context
From the FB-063 walkthrough, signed in as a founder. THE RESET's board, top to bottom: *"no agent lane
running yet"*, a greyed composer note, *"No runs recorded yet"*, and two repositories with *"No
tickets on the default branch"*. There is no next action anywhere on the page.

This is the same criticism the composer and I both levelled at ARCA's own Overview — nine empty
panels and no way forward — aimed at our own front door. It would be embarrassing to ship the
critique and not the fix.

## Scope
- **A first-run state.** When a venture has produced nothing yet, the board is replaced by a short
  welcome and **exactly one action**: tell the studio what you want. Nothing else competes with it.
- **One venture means no picker.** A founder with a single venture lands in it. The list is an admin
  view and should look like one.
- **Every remaining empty panel says what would fill it**, in a sentence, and offers the step that
  starts it — not just that it is empty.
- **Distinguish "nothing yet" from "cannot tell".** A venture with no box has no lane to be offline;
  a venture whose state could not be read is a different thing and must say so. The read model
  already carries this (`engineState`, `degraded`) — the UI should use it.

## Out of scope
- The composer's own location (FB-065) and the GitHub break (FB-064).

## Acceptance criteria
- [x] A brand-new venture shows one action, not a board of empty panels. The welcome replaces the
      board entirely rather than being added above it — four reworded empty boxes would still be
      four empty boxes.
- [x] A founder with one venture never sees a venture list. Admins still do, because they are
      genuinely choosing between several.
- [x] Every empty state names what would fill it and how to begin, in one shape: *what would be
      here*, then *what starts it*. An empty approvals queue reads as the good state — "nothing is
      waiting for you" — rather than as a gap, because that surface should be calm until it is not.
- [x] "No lane yet" and "we could not read this" are visibly different, and the second can never
      wear the first's clothes: a read failure takes the welcome off the table entirely.

## The rule this ticket is really about
**"Nothing has happened yet" and "we could not find out" are different facts.**

A welcome shown over an unreadable venture states a fact we do not have — it tells a founder their
venture is a blank page when the truth is the studio could not see it. So the welcome is only ever
shown when every read succeeded and genuinely came back empty; any failure (an unreachable repo, an
unreadable state ref, a budgets file that would not parse) produces a different page that says what
failed. They are separate components rather than one with a flag, so the two can never be confused by
a later edit.

The second rule: **never offer an action that does not exist yet.** A venture with no box has no
composer to be told, so its welcome offers no button. Ross would otherwise click "tell the studio what
you want" and find nothing there, which is a worse first minute than an honest empty one.

## What the walkthrough showed
Signed in as `ross@bruntsfield.capital`, against THE RESET — the genuinely empty venture:

**Before**: four empty panels — *"no agent lane running yet"*, a greyed composer note, *"No runs
recorded yet"*, and two repositories with *"No tickets on the default branch"*. No next action.

**After**: `Welcome, Ross.` — THE RESET is set up, its machine is still being built, nothing for him
to do, and what will be here when it is.

The first version of that page was correct and nearly empty: a greeting, two sentences, and a great
deal of whitespace. A page with nothing to do on it *and* nothing to read is hard to tell from a
broken one, so the no-box branch now lists what will appear. The with-a-box branch deliberately lists
nothing — there is one action, and a list beside it would compete with it.

## The bug this ticket nearly shipped
The first version decided "brand new" from tickets, runs and approvals. THE RESET has none of those —
and its platform repo has a **failing build from January**. So the board greeted the founder with
*"Nothing has happened yet, which is exactly right for day one"* over a red build.

Comforting a founder about a problem they have, on the screen built to stop the studio saying
comfortable untrue things. It was caught by three existing tests failing, not by the new ones — the
staleness test, the isolation test and the not-provisioned-repo test all pointed at the same wrong
assumption from different directions.

Repo history is now part of the signal: a commit, a merged PR or a build means the venture is not a
blank page, however long ago it was. Health read errors count as read failures too, for the same
reason — THE RESET's marketing repo returns *"Repository thereset-marketing not found"*, and a
welcome over that would have been the other half of the same lie.

## Still open
- ⚠ **The with-action branch has no rendered proof.** It needs a venture that is both empty and
  provisioned, and none exists yet: THE RESET and the modernisation engine have no box, and ARCA has
  a box and work. The copy, the label and the link are unit-tested; the first real screenshot of it
  will be the day THE RESET's box lands.
- ⚠ **THE RESET has no box, so Ross's live run currently ends on "your machine is still being
  built".** That is the page working correctly, and it is also the thing to fix before the run:
  FB-011 provisioning has not been done for THE RESET.

## Verification
16 unit tests over the read model — when a welcome is allowed and when it is forbidden, what each
empty panel says, both welcome branches, the name handling — plus 6 Playwright: an empty venture is a
welcome and the old empty panels are *gone* (not reworded); a venture with no box offers no action it
cannot honour and says what will be there instead; **a venture with a failing build is never greeted
as a blank page**; a founder with one venture never sees a picker; an admin still does; and a venture
with work in it still gets its board, so the welcome can never swallow a real one.

The venture-isolation test moved with the surface rather than being softened: Ross is asserted to
land in THE RESET, and ARCA is asserted to be **refused when asked for by name** — which is the
guarantee that actually matters, and is the one enforced server-side. A picker he cannot see never
was.
