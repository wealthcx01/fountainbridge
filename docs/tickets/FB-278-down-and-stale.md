# FB-278 — When the factory goes quiet

**Status:** Todo · **Kind:** small · **Budget:** $15 · **Rough date:** 7 November 2026 · **Pilot step:** 7 · **Raised by:** John, 28 October 2026 (the factory pilot, `docs/prd/factory-pilot-release.md`) · One ticket = one branch = one PR.

## Why

A founder pressing a button on a card the factory can no longer see would think something happened
when nothing did.

## What to do

- The box reports every minute. After five minutes of silence, the cards say "The factory hasn't
  reported since 10:42. These may be out of date.", the buttons switch off, and the page says why.
- A press the box hasn't collected within 10 minutes ends with "Nothing was done."
- When the box reports again, the buttons come back.

## Done when

- [ ] Journey 7 in `harness/END-TO-END.md` passes against a test copy.
- [ ] Every command in `CLAUDE.md` `## Checks` passes.
