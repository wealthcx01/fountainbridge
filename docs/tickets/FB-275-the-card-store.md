# FB-275 — The door and the card store

**Status:** Todo · **Kind:** medium · **Budget:** $25 · **Rough date:** 4 November 2026 · **Pilot step:** 4 · **Raised by:** John, 28 October 2026 (the factory pilot, `docs/prd/factory-pilot-release.md`) · One ticket = one branch = one PR.

## Why

The factory's cards, its screenshots and its preview links need somewhere to live in the studio,
stored by venture so that one founder can never read another's.

## What to do

- A door on the studio that only the planning box can use, for cards, heartbeats, screenshots and
  preview links.
- Each card is stored with its venture, worked out from its repository and the manifests' `repos`.
- Every read passes `requireVenture`, backed by the database's row-level security (FB-170).
- The parts meant for John (costs, "What to do next", Archon links) are removed on the server, never
  sent to a founder's browser.
- Preview links are checked by `lib/preview-check.ts`.
- Screenshots live in the studio's database, never in git (this repository is public).

## Done when

- [ ] A test tries to read another venture's card by every route and gets nothing.
- [ ] A card that isn't yours gets the same answer as one that doesn't exist.
- [ ] The Review screen (FB-274) reads from the store instead of the fixtures.
- [ ] Every command in `CLAUDE.md` `## Checks` passes.
