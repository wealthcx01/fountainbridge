# FB-263 — The studio misreads a ticket id whose prefix has a hyphen in it

**Status:** Todo · **Phase:** 3 · **Raised by:** review of FB-146, 2026-10-02 ·
**Depends on:** FB-146 · One ticket = one branch = one PR.

## What happens

A venture's ticket ids start with a prefix. ARCA's is one word: `ARCA-074`. The launch venture's has
a hyphen in it: `THE-RESET-012` (the filer builds the prefix from the repository name, so a repository
such as `thereset-platform` gives `THERESET-PLATFORM`, which has one too).

FB-146 taught the composer's ticket filer to read a prefix like that. Two places in the studio itself
still expect a prefix to be one word of letters, so they misread the-reset's ids:

- **The composer's side panel** (`lib/composer-rail.ts`, the title line). It takes the id off the front
  of a draft ticket's title, so the panel shows "Onboarding". For ARCA that works. For the-reset the
  id is left in, so the panel shows "THE-RESET-NEW — Onboarding".
- **The sentence about the busiest ticket on "What happened"** (`ticketInWords` in
  `lib/history-scope.ts`). It turns `ARCA-061-saved-card-lists` into "ARCA-061 — saved card lists".
  For `THE-RESET-012-onboarding` it cannot split the id from the words, so the founder reads the raw
  file name.

## Why it matters

Both are on screens a founder reads, and the-reset is the venture that matters most. Nothing is lost
or filed wrongly: these are display faults. But a raw file name or a stray id in a title is exactly
the kind of wording non-negotiable 12 forbids, and it shows up only on the launch venture, which no
fixture uses.

## Scope

- Read a prefix of several hyphen-joined words in both places. Use FB-146's rule: each word starts
  with a letter, and the first word that starts with a digit is the ticket number. That rule keeps
  `ARCA-012-step-2-onboarding` from being misread as ticket 2.
- A test for each with a `THE-RESET` id beside the `ARCA` one. Break the fix and watch each go red.

## Out of scope

- The filer in `deploy/librechat/ticket-mcp/`. FB-146 fixed it.
- How a prefix is chosen.

## Acceptance criteria

- [ ] The composer's side panel shows "Onboarding", not "THE-RESET-NEW — Onboarding", for a
  the-reset draft.
- [ ] `ticketInWords('THE-RESET-012-onboarding')` reads "THE-RESET-012 — onboarding".
- [ ] `ticketInWords('ARCA-012-step-2-onboarding')` still reads "ARCA-012 — step 2 onboarding".
