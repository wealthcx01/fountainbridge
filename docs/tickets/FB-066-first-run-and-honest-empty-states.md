# FB-066 — Day one: one action, and empty states that say what would fill them

**Status:** Planned · **Phase:** 3 · **Depends on:** FB-063 (the audit) · **Repo:** fountainbridge ·
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
- [ ] A brand-new venture shows one action, not a board of empty panels.
- [ ] A founder with one venture never sees a venture list.
- [ ] Every empty state names what would fill it and how to begin.
- [ ] "No lane yet" and "we could not read this" are visibly different.

## Verification
`/review` + CI, plus a walkthrough as `ross@bruntsfield.capital` against THE RESET — the genuinely
empty venture — with before and after screenshots on the PR.
