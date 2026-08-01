# FB-068 — One date format, one alarm colour, badges that explain themselves

**Status:** Done · **Phase:** 3 · **Depends on:** FB-063 (the audit), FB-057 (the design contract)
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

## What changed

### One date, one owner
`lib/when.ts`. Four helpers had grown up in four files — `relTime` on the activity page, `formatAge`
on the queue, `waitingFor` in the work evidence, and a bare `toLocaleTimeString` on the board — which
is exactly why three formats were reachable on one page.

One vocabulary, several sentences: `howLong` returns the duration alone (*"3 days"*) so the caller
writes *"waiting 3 days"* or *"3 days ago"*. `onDate` handles the one place a founder wants the day
itself, in `en-GB` explicitly — `6/20/2026` for one reader and `20/06/2026` for another is ambiguous
for both.

The `E2E_NOW` seam is honoured, because it is what stops a green suite turning red on its own once
the calendar moves past the fixtures (FB-032). And nothing is ever negative: two machines with
disagreeing clocks are ordinary here — the studio writes some of these timestamps and GitHub writes
others — and *"in -3 days"* is the sort of thing that makes a founder distrust the whole page.

### One alarm
Four approval cards each carried the identical department budget paragraph, in red. One fact about a
department, repeated as though it were four facts about four actions — which flattened the hierarchy,
so a grant the studio *could not verify* read no louder than a routine spend.

The department states its position once, on the board, **with the provenance line moved there with
it** — FB-054's reasoning is unchanged and the studio still says it owns the limit and does not own
the spend. A card now says only *"This one costs £5,200."*

### One badge
`⚠ 1 WARNING`, `⚠ STALE` — real information a founder could neither act on nor find out more about. A
badge that cannot be interrogated trains people to ignore badges.

Each now says what it means in words rather than in a code word, carries an explanation, and is
reachable by keyboard rather than by hover alone:

| Was | Is | On focus or hover |
| --- | --- | --- |
| `⚠ 1 warning` | ⚠ 1 ticket not fully read | "…some detail is missing from the board, and nothing is lost in git." |
| `⚠ stale` | ⚠ nothing here lately | "Nothing has been built or changed here for over two weeks. That may be fine — it is only worth a look if you expected something to be happening." |

## Acceptance criteria
- [ ] One date format across the founder-facing UI, from one helper, deterministic under `E2E_NOW`.
- [ ] The budget position appears once per department; a card shows this action's cost.
- [ ] Red appears only where something is genuinely wrong.
- [ ] Every badge explains itself, by keyboard as well as pointer.

## Verification
`/review` + CI, including a design-lint rule for the date helper so a fifth format cannot quietly
appear, and the UI gate covering the badge explanation.
