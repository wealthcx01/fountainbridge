# FB-275 — The door and the card store

**Status:** Done · **Kind:** medium · **Budget:** $25 · **Rough date:** 4 November 2026 · **Pilot step:** 4 · **Raised by:** John, 28 October 2026 (the factory pilot, `docs/prd/factory-pilot-release.md`) · One ticket = one branch = one PR.

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

- [x] A test tries to read another venture's card by every route and gets nothing.
- [x] A card that isn't yours gets the same answer as one that doesn't exist.
- [x] The Review screen (FB-274) reads from the store instead of the fixtures.
- [x] Every command in `CLAUDE.md` `## Checks` passes.

## What shipped

- **The door:** `POST /api/factory` (`app/api/factory/route.ts`, `lib/factory-door.ts`), signed with
  `FACTORY_DOOR_SECRET`. Unset, it answers 404 to everything. The format the box sends is in
  `docs/factory-cards.md`.
- **The store:** `db/008_factory_cards.sql`: cards, pictures (as bytes) and the box's heartbeat, with
  forced row-level security by venture on cards and pictures (`lib/card-store.ts`).
- **The Review screen** reads its cards and pictures from the store. The browser tests put them in
  through the door, signed with the test secret (`e2e/review-cards.ts`).
- **Tests:** `lib/__tests__/factory-door.test.ts` (every way in that is not the box),
  `lib/__tests__/card-store.test.ts` (row-level security against real Postgres, and the Review
  screen read from it), `app/__tests__/factory-routes.test.ts` (the closed door, and the picture
  route by every address), and `e2e/review.spec.ts`.

Left for later tickets: presses still go to the test copy's file until FB-276; cards in "Needs you"
and "What happened" are FB-277, and so are cards for cowgate, which no venture lists, so the door
refuses them today; FB-278 reads the heartbeat.
