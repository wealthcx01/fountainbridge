# FB-146 — A hyphenated venture prefix is not recognised as a prefix

**Status:** Done · **Area:** Composer / ticket-filer · **Depends on:** FB-118

## What happens

The filer derives a venture's ticket prefix from its repo name (`REPO.split('/')[1].toUpperCase()`),
so the launch venture's is `THE-RESET`. Two regexes in the filer expect a prefix to be letters only:

- `existingTicketFile` matches `^[A-Za-z]+-\d+-<slug>\.md$`. `THE-RESET-012-onboarding.md` does not
  match it, because `[A-Za-z]+` cannot cross the hyphen.

Found while fixing FB-118, which fixed the third instance of the same mistake (`idOf`, added there,
and the `idNumber` regex, escaped there). This one is older and is not made worse by FB-118, so it is
a ticket rather than scope creep in that PR.

## Why it matters

`existingTicketFile` is what makes re-filing a ticket **update** it instead of filing a second one.
The composer tells founders to revise and re-file, so on `the-reset` every revision would take a
fresh number and leave a trail of half-written duplicates — the exact failure FB-097's idempotency
note describes, on the one venture that matters most.

It has not bitten yet only because `the-reset` has never filed through the composer.

## Scope

- Accept a prefix containing hyphens and digits everywhere a prefix is matched in
  `deploy/librechat/ticket-mcp/`.
- A test for each, using `THE-RESET` rather than `ARCA` — the ARCA cases all pass today and prove
  nothing about this.

## Out of scope

- Changing how the prefix is derived. `VENTURE_TICKET_PREFIX` and the repo-name fallback stay as they
  are; this is only about reading one back.

## Acceptance criteria

- [x] `existingTicketFile(['THE-RESET-012-onboarding.md'], 'onboarding')` finds it.
- [x] Re-filing the same slug on `the-reset` updates the ticket rather than allocating a new number.
- [x] Every prefix regex in `ticket-mcp/` has a `THE-RESET` case beside its `ARCA` one.

## What shipped

- A prefix may now be several words joined by hyphens, and a word may contain digits
  (`THE-RESET`, `VENTURE2`). Each word must start with a letter. That rule is what keeps the ticket
  number findable: the first word that starts with a digit is always the number. Without it,
  `ARCA-012-step-2-onboarding.md` could be misread as ticket 2 with the slug `onboarding`, and
  re-filing `onboarding` would overwrite a different ticket.
- The filer now passes the venture's own prefix to `existingTicketFile`, so on a known venture it
  matches that prefix exactly rather than any prefix-shaped word.
- The same mistake was in two more places in the same file, both in `withTicketId`. A
  `# THE-RESET-NEW — Title` placeholder was not recognised, and a revision headed
  `# THE-RESET-012 — Title` was given a second id in front of its first. Both are fixed.
- `withTicketId` counts a heading as already numbered only when it starts with this venture's own
  prefix, read off the id it is given. Before that, any hyphenated word with a number in it counted,
  so a heading such as `# Fix-step-2 — Onboarding` would have been left with no id.
- `idOf`, which reads the id back out of a filename, moved from `stdio.mjs` into `ids.mjs` so it can
  be tested. `stdio.mjs` starts a server the moment it is loaded, so nothing in it can be.

The re-filing path is proven by the two calls the filer makes, `existingTicketFile` then `idOf`, run
on a `THE-RESET` backlog. The filer itself was not run against the-reset's real repository: that
would file a real ticket, and the-reset has never filed through the composer.

The same letters-only mistake is in two places outside `ticket-mcp/`, in the studio itself: the
composer's side panel and the "What happened" sentence about the busiest ticket. They are outside
this ticket's scope, so they are filed as FB-263.
