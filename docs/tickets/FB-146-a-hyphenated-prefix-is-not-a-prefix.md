# FB-146 — A hyphenated venture prefix is not recognised as a prefix

**Status:** Todo · **Area:** Composer / ticket-filer · **Depends on:** FB-118

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

- [ ] `existingTicketFile(['THE-RESET-012-onboarding.md'], 'onboarding')` finds it.
- [ ] Re-filing the same slug on `the-reset` updates the ticket rather than allocating a new number.
- [ ] Every prefix regex in `ticket-mcp/` has a `THE-RESET` case beside its `ARCA` one.
