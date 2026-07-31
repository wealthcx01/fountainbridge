# FB-068 — One date format, one alarm colour, badges that explain themselves

**Status:** Planned · **Phase:** 3 · **Depends on:** FB-063 (the audit), FB-057 (the design contract)
· **Repo:** fountainbridge · **Branch:** `fb-068-one-format-one-alarm-one-badge`
One ticket = one branch = one PR.

## Why this matters (for the founder)
Small inconsistencies are how a product stops feeling made. These are the three that recur on every
screen.

## Context
The remaining unticked items from FB-063. Each is small on its own; each is currently spread across
several call sites, which is why they drifted in the first place. Each wants **one owner** rather
than four edits.

### Dates
Three formats on one page: `3:05:32 PM` in the header, `20 June 2026` on a decided approval,
`2026-07-21T18:30:00Z` in the activity strip. The ISO one was deliberate — a relative time computed
server-side is wrong the moment the page is cached — but a raw `T` and `Z` is a developer's format on
a founder's screen. One helper, one founder-facing format, honouring the `E2E_NOW` clock seam so the
UI gate stays deterministic (FB-032).

### The alarm colour
On ARCA's board four approval cards each carry the identical budget paragraph, in red. It is one fact
about a department, repeated as though it were four facts about four actions — and it flattens the
hierarchy, so a grant the studio *could not verify* reads no louder than a routine spend.

The fix is a judgement about FB-054's feature, not a typo, which is why it was left out of the FB-063
fixes: the founder seeing cost at approve-time is the point of that ticket and it took three review
passes to get right. The proposal here: the **department** owns the budget position and states it
once; the **card** states only what *this* action costs, and red is reserved for what is genuinely
alarming.

### Badges
`⚠ 1 WARNING` beside a venture name, `⚠ 1` on a ticket card, `⚠ STALE` on a repository that has never
had a commit. Each is real information a founder cannot act on or find out more about. A badge that
cannot be interrogated trains people to ignore badges.

## Scope
- One date helper, one founder-facing format, used everywhere; clock seam preserved.
- Budget position stated once per department; per-action cost on the card; alarm colour reserved.
- Every badge either explains itself on hover and focus, or is removed. Keyboard-reachable, not
  hover-only.

## Out of scope
- Changing what the budget disclosure *means* (FB-054's reasoning stands — the studio owns the limit
  and does not own the spend, and says so).

## Acceptance criteria
- [ ] One date format across the founder-facing UI, from one helper, deterministic under `E2E_NOW`.
- [ ] The budget position appears once per department; a card shows this action's cost.
- [ ] Red appears only where something is genuinely wrong.
- [ ] Every badge explains itself, by keyboard as well as pointer.

## Verification
`/review` + CI, including a design-lint rule for the date helper so a fifth format cannot quietly
appear, and the UI gate covering the badge explanation.
